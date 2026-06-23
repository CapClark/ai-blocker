import { MSG, getSettings, saveSettings } from '../shared/settings.js';

const $ = (sel) => document.querySelector(sel);

const hostOf = (url) => {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
};

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function setSegments(settings) {
  document.querySelectorAll('.seg').forEach((seg) => {
    const value = settings[seg.dataset.key];
    seg.querySelectorAll('button').forEach((b) =>
      b.classList.toggle('active', b.dataset.val === value)
    );
  });
}

function summarize(breakdown, host, settings) {
  if (!settings.enabled) return 'Blocking is off';
  if (host && settings.allowlist.includes(host)) return 'Paused on this site';
  const s = breakdown?.surfaces || 0;
  const m = breakdown?.media || 0;
  if (s + m === 0) return 'All clear here ✨';
  const parts = [];
  if (s) parts.push(`${s} AI ${s === 1 ? 'surface' : 'surfaces'} hidden`);
  if (m) parts.push(`${m} AI ${m === 1 ? 'image' : 'images'} flagged`);
  return parts.join(' · ');
}

let state = { host: '', settings: null };

async function render() {
  const settings = await getSettings();
  const tab = await activeTab();
  const host = hostOf(tab?.url || '');
  state = { host, settings };

  let breakdown = { surfaces: 0, media: 0 };
  try {
    const res = await chrome.tabs.sendMessage(tab.id, { type: MSG.GET_STATS });
    if (res?.breakdown) breakdown = res.breakdown;
  } catch {
    /* no content script here (chrome://, web store, etc.) */
  }

  const total = breakdown.surfaces + breakdown.media;
  $('#count').textContent = total;
  $('#hero').classList.toggle('clear', total === 0 || !settings.enabled);
  $('#summary').textContent = summarize(breakdown, host, settings);

  $('#enabled').checked = settings.enabled;
  $('#host').textContent = host || 'this page';

  const allowlisted = settings.allowlist.includes(host);
  $('#allow').checked = host ? !allowlisted : false;
  $('#allow').disabled = !host || !settings.enabled;

  setSegments(settings);
}

document.addEventListener('DOMContentLoaded', async () => {
  await render();

  $('#enabled').addEventListener('change', async (e) => {
    await saveSettings({ enabled: e.target.checked });
    await render();
  });

  $('#allow').addEventListener('change', async (e) => {
    const { host, settings } = state;
    if (!host) return;
    const set = new Set(settings.allowlist);
    if (e.target.checked) set.delete(host);
    else set.add(host);
    await saveSettings({ allowlist: [...set] });
    await render();
  });

  document.querySelectorAll('.seg button').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const key = btn.parentElement.dataset.key;
      await saveSettings({ [key]: btn.dataset.val });
      await render();
    });
  });

  $('#options').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
});
