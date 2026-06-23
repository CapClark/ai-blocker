import { MSG, FILTERS_KEY, getSettings, saveSettings } from '../shared/settings.js';

const $ = (sel) => document.querySelector(sel);

function describeFilters(record) {
  if (!record?.updated) return 'Never — add a subscription URL below';
  const when = new Date(record.updated).toLocaleString();
  const counts = `${record.cosmetic?.length || 0} rules, ${record.slopDomains?.length || 0} domains`;
  const failed = (record.sources || []).filter((s) => !s.ok).length;
  return `${when} · ${counts}` + (failed ? ` · ${failed} source(s) failed` : '');
}

async function renderFilterStatus() {
  const raw = await chrome.storage.local.get(FILTERS_KEY);
  $('#filters-status').textContent = describeFilters(raw[FILTERS_KEY]);
}

const CATEGORIES = [
  ['search', 'Search', 'AI Overviews, Copilot, AI assist'],
  ['social', 'Social', 'Grok, Meta AI, collaborative articles'],
  ['shopping', 'Shopping', 'AI review summaries'],
  ['productivity', 'Productivity', 'Gemini, Help me write'],
];

function renderCategories(settings) {
  const wrap = $('#categories');
  wrap.innerHTML = '';
  for (const [key, title, desc] of CATEGORIES) {
    const row = document.createElement('label');
    row.className = 'row toggle';

    const text = document.createElement('span');
    text.className = 'text';
    text.innerHTML = `<b>${title}</b><small>${desc}</small>`;

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'switch';
    cb.checked = settings.categories[key] !== false;
    cb.addEventListener('change', () => saveSettings({ categories: { [key]: cb.checked } }));

    row.append(text, cb);
    wrap.append(row);
  }
}

function setSegments(settings) {
  document.querySelectorAll('.seg').forEach((seg) => {
    const value = settings[seg.dataset.key];
    seg.querySelectorAll('button').forEach((b) =>
      b.classList.toggle('active', b.dataset.val === value)
    );
  });
}

async function render() {
  const settings = await getSettings();
  $('#enabled').checked = settings.enabled;
  $('#slopBadge').checked = settings.slopBadge;
  $('#allowlist').value = (settings.allowlist || []).join('\n');
  $('#subs').value = (settings.filterSubscriptions || []).join('\n');
  setSegments(settings);
  renderCategories(settings);
  await renderFilterStatus();
}

const parseLines = (value) =>
  value
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

document.addEventListener('DOMContentLoaded', async () => {
  await render();

  $('#enabled').addEventListener('change', (e) => saveSettings({ enabled: e.target.checked }));
  $('#slopBadge').addEventListener('change', (e) => saveSettings({ slopBadge: e.target.checked }));

  document.querySelectorAll('.seg button').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const key = btn.parentElement.dataset.key;
      await saveSettings({ [key]: btn.dataset.val });
      await render();
    });
  });

  $('#allowlist').addEventListener('change', (e) => {
    saveSettings({ allowlist: parseLines(e.target.value).map((s) => s.toLowerCase()) });
  });

  $('#subs').addEventListener('change', (e) => {
    saveSettings({ filterSubscriptions: parseLines(e.target.value) });
  });

  $('#refresh').addEventListener('click', async () => {
    const btn = $('#refresh');
    btn.disabled = true;
    btn.textContent = 'Updating…';
    // persist any unsaved URL edits first, then fetch
    await saveSettings({ filterSubscriptions: parseLines($('#subs').value) });
    try {
      await chrome.runtime.sendMessage({ type: MSG.REFRESH_FILTERS });
    } catch {
      /* worker unavailable — status will simply stay as-is */
    }
    await renderFilterStatus();
    btn.disabled = false;
    btn.textContent = 'Update now';
  });
});
