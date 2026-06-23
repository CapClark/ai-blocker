// ES module — used by the service worker, popup, and options page.
// (Content scripts can't import modules from a manifest declaration, so the
//  same constants are mirrored in src/shared/constants.js — keep them in sync.)

export const STORAGE_KEY = 'aiblock:settings';
export const FILTERS_KEY = 'aiblock:filters'; // cached remote filter lists

export const MSG = {
  STATS_UPDATE: 'aiblock:stats-update',     // content -> background (badge)
  GET_STATS: 'aiblock:get-stats',           // popup   -> content   (live count)
  CHECK_IMAGE: 'aiblock:check-image',       // content -> background (provenance)
  REFRESH_FILTERS: 'aiblock:refresh-filters', // options -> background (update now)
  CLASSIFY_IMAGE: 'aiblock:classify-image', // background -> offscreen (pixel model)
  VERIFY_RESULT: 'aiblock:verify-result',   // background -> content (right-click verify)
};

// Keep DEFAULT_SETTINGS in sync with src/shared/constants.js.
export const DEFAULT_SETTINGS = {
  enabled: true,
  action: 'remove', // 'remove' | 'collapse'
  mediaAction: 'label', // 'label' | 'blur' | 'off' — declared AI images
  allowlist: [], // hostname suffixes to skip entirely
  categories: { search: true, social: true, shopping: true, productivity: true },
  slopBadge: true, // floating badge on flagged "AI slop" domains
  // Default hot-patch list (refreshed daily) — edit filters/live.json in the
  // repo to fix rotted selectors for every install without an extension release.
  filterSubscriptions: ['https://raw.githubusercontent.com/CapClark/ai-blocker/main/filters/live.json'],
};

export function mergeDefaults(s) {
  const base = structuredClone(DEFAULT_SETTINGS);
  if (!s) return base;
  return { ...base, ...s, categories: { ...base.categories, ...(s.categories || {}) } };
}

export async function getSettings() {
  const raw = await chrome.storage.local.get(STORAGE_KEY);
  return mergeDefaults(raw[STORAGE_KEY]);
}

export async function saveSettings(patch) {
  const cur = await getSettings();
  const next = {
    ...cur,
    ...patch,
    categories: { ...cur.categories, ...(patch.categories || {}) },
  };
  await chrome.storage.local.set({ [STORAGE_KEY]: next });
  return next;
}
