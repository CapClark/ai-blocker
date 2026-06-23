// Background service worker (ES module). Owns the per-tab badge, image
// provenance lookups, remote filter-list subscriptions, and the offscreen ML
// hook reserved for a later layer.
import { MSG, FILTERS_KEY, getSettings } from '../shared/settings.js';
import { parseProvenance } from './provenance.js';

// --- per-tab badge ---------------------------------------------------------

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg?.type === MSG.STATS_UPDATE && sender.tab?.id != null) {
    const n = Math.max(0, msg.count | 0);
    chrome.action.setBadgeText({ tabId: sender.tab.id, text: n ? String(n) : '' });
    chrome.action.setBadgeBackgroundColor({ tabId: sender.tab.id, color: '#0d9488' });
  }
});

chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.status === 'loading') chrome.action.setBadgeText({ tabId, text: '' });
});

// --- image provenance ------------------------------------------------------
// Content scripts can't read cross-origin bytes, but the worker can (host
// permissions). We fetch only the leading bytes, where EXIF/XMP/C2PA markers
// live, and cache verdicts per URL for the session.

const FETCH_CAP = 256 * 1024;
const CACHE_MAX = 1500;
const cache = new Map();

async function checkImage(url) {
  const cached = cache.get(url);
  if (cached) return cached;

  let result = { verdict: 'none', source: '' };
  try {
    const res = await fetch(url, { headers: { Range: `bytes=0-${FETCH_CAP - 1}` } });
    if (res.ok) {
      let buf = await res.arrayBuffer();
      if (buf.byteLength > FETCH_CAP) buf = buf.slice(0, FETCH_CAP);
      result = parseProvenance(buf);
    }
  } catch {
    /* network/CORS failure — treat as unknown */
  }

  if (cache.size >= CACHE_MAX) cache.clear();
  cache.set(url, result);
  return result;
}

// --- remote filter subscriptions -------------------------------------------
// Filter lists are *data*, not code (MV3 forbids remote code). We fetch the
// user's subscription URLs, strictly sanitize the JSON into the shapes the
// engine understands, and cache the result for the content scripts to merge.

const CATEGORIES = ['search', 'social', 'shopping', 'productivity'];

function sanitizeRule(r) {
  if (!r || typeof r.id !== 'string') return null;
  const hosts = Array.isArray(r.hosts) ? r.hosts.filter((h) => typeof h === 'string') : [];
  if (!hosts.length) return null;
  const css = Array.isArray(r.css) ? r.css.filter((s) => typeof s === 'string') : undefined;
  const text = Array.isArray(r.text)
    ? r.text
        .filter((t) => t && typeof t.contains === 'string')
        .map((t) => ({
          contains: t.contains,
          scope: typeof t.scope === 'string' ? t.scope : undefined,
          maxLen: Number.isFinite(t.maxLen) ? t.maxLen : undefined,
          up: Number.isInteger(t.up) ? t.up : undefined,
        }))
    : undefined;
  if (!css?.length && !text?.length) return null;
  return {
    id: r.id,
    label: typeof r.label === 'string' ? r.label : r.id,
    category: CATEGORIES.includes(r.category) ? r.category : 'search',
    hosts,
    css,
    text,
  };
}

function sanitizeList(json) {
  const cosmetic = Array.isArray(json?.cosmetic)
    ? json.cosmetic.map(sanitizeRule).filter(Boolean)
    : [];
  const slopDomains = Array.isArray(json?.slopDomains)
    ? json.slopDomains.filter((d) => typeof d === 'string').map((d) => d.toLowerCase())
    : [];
  return { cosmetic, slopDomains };
}

async function refreshFilters() {
  const { filterSubscriptions = [] } = await getSettings();
  const cosmetic = [];
  const slopDomains = [];
  const sources = [];

  for (const url of filterSubscriptions) {
    try {
      const res = await fetch(url, { cache: 'no-cache' });
      if (!res.ok) {
        sources.push({ url, ok: false, status: res.status });
        continue;
      }
      const list = sanitizeList(await res.json());
      cosmetic.push(...list.cosmetic);
      slopDomains.push(...list.slopDomains);
      sources.push({ url, ok: true, cosmetic: list.cosmetic.length, slop: list.slopDomains.length });
    } catch (e) {
      sources.push({ url, ok: false, error: String(e?.message || e) });
    }
  }

  const record = { updated: Date.now(), sources, cosmetic, slopDomains };
  await chrome.storage.local.set({ [FILTERS_KEY]: record });
  return record;
}

const ALARM = 'aiblock:refresh-filters';
const MENU_ID = 'aiblock-verify-image';

function createMenu() {
  chrome.contextMenus.removeAll(() =>
    chrome.contextMenus.create({
      id: MENU_ID,
      title: 'Verify image with AI Blocker',
      contexts: ['image'],
    })
  );
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(ALARM, { periodInMinutes: 1440 }); // daily
  createMenu();
  refreshFilters();
});
chrome.runtime.onStartup.addListener(() => {
  createMenu();
  refreshFilters();
});
chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === ALARM) refreshFilters();
});

// --- right-click "Verify image" --------------------------------------------
// Explicit, user-initiated heavy check: the cheap provenance read plus the
// (stubbed) on-device pixel classifier, with the result sent back to the page.

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID || !info.srcUrl || tab?.id == null) return;
  const meta = await checkImage(info.srcUrl);
  let ml = { stub: true, score: 0 };
  try {
    ml = await classifyImagePixels(info.srcUrl);
  } catch {
    /* offscreen/model unavailable — keep stub */
  }
  chrome.tabs.sendMessage(tab.id, { type: MSG.VERIFY_RESULT, srcUrl: info.srcUrl, meta, ml });
});

// --- message router (async responses) --------------------------------------

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === MSG.CHECK_IMAGE && typeof msg.url === 'string') {
    checkImage(msg.url).then(sendResponse);
    return true;
  }
  if (msg?.type === MSG.REFRESH_FILTERS) {
    refreshFilters().then((r) =>
      sendResponse({
        ok: true,
        updated: r.updated,
        cosmetic: r.cosmetic.length,
        slop: r.slopDomains.length,
        sources: r.sources,
      })
    );
    return true;
  }
  return false;
});

// --- on-device pixel classifier (offscreen seam) ---------------------------
// Reached only by "Verify image". The offscreen document fetches + decodes the
// image and runs the model on WebGPU; today it returns a labeled stub.

async function ensureOffscreen() {
  if (await chrome.offscreen?.hasDocument?.()) return;
  await chrome.offscreen.createDocument({
    url: 'src/offscreen/offscreen.html',
    reasons: ['WORKERS'],
    justification: 'Run the on-device AI-content classifier on WebGPU.',
  });
}

async function classifyImagePixels(url) {
  await ensureOffscreen();
  const res = await chrome.runtime.sendMessage({ type: MSG.CLASSIFY_IMAGE, url });
  return res || { stub: true, score: 0 };
}
