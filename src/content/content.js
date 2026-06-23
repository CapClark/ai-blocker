// Content-script entry point. Runs at document_start, after the constants /
// filters / engine / media-scanner files have populated globalThis.AIBlocker.
(() => {
  const ns = globalThis.AIBlocker;
  const engine = new ns.Engine();
  const scanner = new ns.MediaScanner();

  const startAll = (settings) => {
    engine.start(settings);
    scanner.start(settings);
  };
  const stopAll = () => {
    engine.stop();
    scanner.stop();
  };
  const restart = (settings) => {
    stopAll();
    startAll(ns.mergeDefaults(settings));
  };

  // 1) Immediate pass with bundled filters + default settings — prevents a
  //    flash of AI content before async storage resolves.
  ns.applyFilters(null);
  startAll(ns.mergeDefaults(null));

  // 2) Reconcile with stored settings + the cached remote filter list.
  chrome.storage.local
    .get([ns.STORAGE_KEY, ns.FILTERS_KEY])
    .then((raw) => {
      ns.applyFilters(raw[ns.FILTERS_KEY]);
      restart(raw[ns.STORAGE_KEY]);
    })
    .catch(() => {});

  // 3) React to live changes: settings edits or a fresh filter subscription.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes[ns.FILTERS_KEY]) ns.applyFilters(changes[ns.FILTERS_KEY].newValue);
    if (changes[ns.STORAGE_KEY] || changes[ns.FILTERS_KEY]) {
      chrome.storage.local.get(ns.STORAGE_KEY).then((raw) => restart(raw[ns.STORAGE_KEY]));
    }
  });

  // 4) Answer the popup's live count query + the worker's verify-image result.
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === ns.MSG.GET_STATS) {
      sendResponse({
        count: ns.stats.surfaces + ns.stats.media,
        breakdown: { ...ns.stats },
        host: location.hostname,
      });
    } else if (msg?.type === ns.MSG.VERIFY_RESULT) {
      scanner.verifyResult(msg);
    }
    return false;
  });
})();
