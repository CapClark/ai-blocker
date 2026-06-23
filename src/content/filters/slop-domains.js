// "AI slop" domain list (Ring 3, reputation-based).
//
// In production this becomes a subscribable, community-maintained feed
// (EasyList-style) fetched and cached by the service worker. The placeholder
// example domains below are intentional — replace them with a real, audited
// feed before shipping, and never flag a legitimate site without evidence.
(() => {
  const ns = (globalThis.AIBlocker = globalThis.AIBlocker || {});

  ns.bundledSlopDomains = [
    'example-ai-content-farm.com',
    'ai-generated-news.example',
  ];

  // Live list = bundled, until content.js merges in the remote subscription.
  ns.slopDomains = ns.bundledSlopDomains;
})();
