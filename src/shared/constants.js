// Classic script — runs in the content-script isolated world (first in the
// content_scripts list) and seeds globalThis.AIBlocker for the other content
// files. Mirror of src/shared/settings.js — keep the two in sync.
(() => {
  const ns = (globalThis.AIBlocker = globalThis.AIBlocker || {});

  ns.STORAGE_KEY = 'aiblock:settings';
  ns.FILTERS_KEY = 'aiblock:filters';

  ns.MSG = {
    STATS_UPDATE: 'aiblock:stats-update',
    GET_STATS: 'aiblock:get-stats',
    CHECK_IMAGE: 'aiblock:check-image',
    REFRESH_FILTERS: 'aiblock:refresh-filters',
    CLASSIFY_IMAGE: 'aiblock:classify-image',
    VERIFY_RESULT: 'aiblock:verify-result',
  };

  ns.DEFAULT_SETTINGS = {
    enabled: true,
    action: 'remove',
    mediaAction: 'label',
    allowlist: [],
    categories: { search: true, social: true, shopping: true, productivity: true },
    slopBadge: true,
    filterSubscriptions: ['https://raw.githubusercontent.com/CapClark/ai-blocker/main/filters/live.json'],
  };

  ns.mergeDefaults = (s) => {
    const base = structuredClone(ns.DEFAULT_SETTINGS);
    if (!s) return base;
    return { ...base, ...s, categories: { ...base.categories, ...(s.categories || {}) } };
  };

  // Merge bundled filter lists with the cached remote subscription (if any).
  // Engines read ns.cosmeticRules / ns.slopDomains, so this just repopulates them.
  ns.applyFilters = (remote) => {
    ns.cosmeticRules = (ns.bundledCosmeticRules || []).concat(remote?.cosmetic || []);
    ns.slopDomains = (ns.bundledSlopDomains || []).concat(remote?.slopDomains || []);
  };

  // Shared tally so the cosmetic engine and the media scanner report one badge.
  ns.stats = { surfaces: 0, media: 0 };

  ns.reportStats = () => {
    try {
      chrome.runtime.sendMessage({
        type: ns.MSG.STATS_UPDATE,
        count: ns.stats.surfaces + ns.stats.media,
        breakdown: { ...ns.stats },
      });
    } catch {
      /* service worker asleep or context invalidated — ignore */
    }
  };
})();
