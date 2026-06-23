// Cosmetic filter list — the "Ring 1" rules: known AI product surfaces.
//
// Each rule:
//   id        unique slug (shown in collapse placeholders, used as a marker)
//   label     human-readable name
//   category  search | social | shopping | productivity  (maps to a settings toggle)
//   hosts     hostname suffixes the rule applies to (matched with endsWith)
//   css       CSS selectors hidden immediately (anti-flash) and counted
//   text      heuristic label matches: { contains, scope?, maxLen?, up? }
//             — finds a small element whose visible text/aria-label contains
//               `contains`, then climbs `up` parents and hides that container.
//
// NOTE: site DOMs change constantly. The `css` selectors are best-effort and
// are the part you'll maintain most often — treat this like an ad-block filter
// list. The `text` rules are more durable because they key off the visible
// "AI Overview" / "Copilot" labels rather than volatile class names.
(() => {
  const ns = (globalThis.AIBlocker = globalThis.AIBlocker || {});

  ns.bundledCosmeticRules = [
    {
      id: 'google-ai-overview',
      label: 'Google AI Overview',
      category: 'search',
      hosts: ['google.com', 'google.co.uk', 'google.ca', 'google.com.au',
        'google.de', 'google.fr', 'google.co.in', 'google.co.jp', 'google.com.br'],
      css: [
        'div[data-attrid="SGE"]',
        'div[data-async-context*="ai_overview"]',
      ],
      text: [
        { contains: 'AI Overview', scope: 'h1,h2,h3,[role="heading"]', maxLen: 24, up: 4 },
      ],
    },
    {
      id: 'google-ai-mode',
      label: 'Google AI Mode',
      category: 'search',
      hosts: ['google.com'],
      text: [
        { contains: 'AI Mode', scope: 'a,div[role="listitem"],span', maxLen: 16, up: 1 },
      ],
    },
    {
      id: 'bing-copilot',
      label: 'Bing Copilot answer',
      category: 'search',
      hosts: ['bing.com'],
      css: ['#b_sydConvCont', '.b_sydConv', 'cib-serp'],
      text: [
        { contains: 'Copilot', scope: 'h2,[role="heading"]', maxLen: 16, up: 3 },
      ],
    },
    {
      id: 'ddg-ai-assist',
      label: 'DuckDuckGo AI assist',
      category: 'search',
      hosts: ['duckduckgo.com'],
      css: ['[data-area="ai"]', 'section[data-testid="ai-assist"]'],
    },
    {
      id: 'amazon-review-summary',
      label: 'Amazon AI review summary',
      category: 'shopping',
      hosts: ['amazon.com', 'amazon.co.uk', 'amazon.de', 'amazon.ca', 'amazon.co.jp', 'amazon.in'],
      css: [
        '#product-summary',
        '[data-csa-c-content-id*="aiReviewSummary"]',
        'div[data-hook="cr-product-insights-card"]',
      ],
    },
    {
      id: 'x-grok',
      label: 'X Grok',
      category: 'social',
      hosts: ['x.com', 'twitter.com'],
      css: ['a[href="/i/grok"]', '[data-testid="GrokDrawer"]', 'button[aria-label*="Grok"]'],
    },
    {
      id: 'facebook-meta-ai',
      label: 'Meta AI',
      category: 'social',
      hosts: ['facebook.com'],
      text: [
        { contains: 'Ask Meta AI', scope: 'span,div[role="button"]', maxLen: 20, up: 2 },
      ],
    },
    {
      id: 'linkedin-collab-articles',
      label: 'LinkedIn collaborative articles',
      category: 'social',
      hosts: ['linkedin.com'],
      text: [
        { contains: 'collaborative article', scope: 'span,a,h2', maxLen: 40, up: 4 },
      ],
    },
    {
      id: 'gmail-gemini',
      label: 'Gmail Gemini / Help me write',
      category: 'productivity',
      hosts: ['mail.google.com'],
      css: ['[aria-label*="Gemini"]'],
      text: [
        { contains: 'Help me write', scope: '[role="button"],span', maxLen: 20, up: 1 },
      ],
    },

    // DEMO ONLY — drives test/index.html when served from localhost. The
    // attribute selector matches nothing on real sites, so this is harmless to
    // ship, but you can delete it once you're done with the test page.
    {
      id: 'demo-ai-overview',
      label: 'Demo AI Overview',
      category: 'search',
      hosts: ['localhost', '127.0.0.1'],
      css: ['[data-aiblock-demo="ai-overview"]'],
    },
  ];

  // Live list = bundled, until content.js merges in the remote subscription.
  ns.cosmeticRules = ns.bundledCosmeticRules;
})();
