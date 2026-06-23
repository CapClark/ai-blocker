// Cosmetic engine: applies the filter list to the page, watches for dynamic
// content, and tallies hidden surfaces. Runs in the content-script world.
(() => {
  const ns = (globalThis.AIBlocker = globalThis.AIBlocker || {});
  const DEFAULT_SCOPE = 'h1,h2,h3,[role="heading"],[aria-label]';
  const DEFAULT_HOPS = 2;

  const hostMatches = (host, patterns) =>
    patterns.some((p) => host === p || host.endsWith('.' + p));

  class Engine {
    constructor() {
      this.host = location.hostname;
      this.settings = null;
      this.rules = [];
      this.preemptStyle = null;
      this.observer = null;
      this.processed = new WeakSet();
      this.scanScheduled = false;
    }

    activeRules(settings) {
      return (ns.cosmeticRules || []).filter(
        (r) => settings.categories[r.category] !== false && hostMatches(this.host, r.hosts)
      );
    }

    // --- lifecycle ---------------------------------------------------------

    start(settings) {
      this.settings = settings;
      this.processed = new WeakSet();
      ns.stats.surfaces = 0;

      const skip = !settings.enabled || hostMatches(this.host, settings.allowlist);
      if (!skip) {
        this.rules = this.activeRules(settings);
        if (this.rules.length) {
          this.injectPreemptStyle();
          this.observe();
          this.scheduleScan();
        }
      }
      this.maybeSlopBadge(settings);
      ns.reportStats();
    }

    stop() {
      this.observer?.disconnect();
      this.observer = null;
      this.preemptStyle?.remove();
      this.preemptStyle = null;
      document.querySelectorAll('[data-aiblock]').forEach((el) => {
        el.style.removeProperty('display');
        el.removeAttribute('data-aiblock');
      });
      document.querySelectorAll('.aiblock-placeholder').forEach((el) => el.remove());
      this.rules = [];
      ns.stats.surfaces = 0;
    }

    // --- anti-flash --------------------------------------------------------

    injectPreemptStyle() {
      const selectors = this.rules.flatMap((r) => r.css || []);
      if (!selectors.length) return;
      const style = document.createElement('style');
      style.id = 'aiblock-preempt';
      style.textContent = selectors.join(',\n') + ' { display: none !important; }';
      (document.head || document.documentElement).appendChild(style);
      this.preemptStyle = style;
    }

    // --- scanning ----------------------------------------------------------

    observe() {
      this.observer = new MutationObserver(() => this.scheduleScan());
      this.observer.observe(document.documentElement, { childList: true, subtree: true });
    }

    scheduleScan() {
      if (this.scanScheduled) return;
      this.scanScheduled = true;
      const run = () => {
        this.scanScheduled = false;
        this.scan();
      };
      if ('requestIdleCallback' in window) requestIdleCallback(run, { timeout: 300 });
      else setTimeout(run, 120);
    }

    scan() {
      let changed = false;
      for (const rule of this.rules) {
        for (const sel of rule.css || []) {
          let nodes;
          try {
            nodes = document.querySelectorAll(sel);
          } catch {
            continue;
          }
          nodes.forEach((n) => {
            changed = this.process(n, rule) || changed;
          });
        }
        for (const t of rule.text || []) changed = this.scanText(rule, t) || changed;
      }
      if (changed) ns.reportStats();
    }

    scanText(rule, t) {
      const max = t.maxLen ?? 48;
      const needle = t.contains.toLowerCase();
      let cands;
      try {
        cands = document.querySelectorAll(t.scope || DEFAULT_SCOPE);
      } catch {
        return false;
      }
      let changed = false;
      cands.forEach((el) => {
        const label = (el.getAttribute('aria-label') || el.textContent || '').trim();
        if (label.length > max || !label.toLowerCase().includes(needle)) return;
        let target = el;
        const hops = t.up ?? DEFAULT_HOPS;
        for (let i = 0; i < hops && target.parentElement; i++) target = target.parentElement;
        changed = this.process(target, rule) || changed;
      });
      return changed;
    }

    // --- actions -----------------------------------------------------------

    process(el, rule) {
      if (!el || this.processed.has(el) || el.dataset?.aiblock) return false;
      if (el === document.body || el === document.documentElement) return false;
      this.processed.add(el);
      el.dataset.aiblock = rule.id;

      if (this.settings.action === 'collapse') this.collapse(el, rule);
      else el.style.setProperty('display', 'none', 'important');

      ns.stats.surfaces++;
      return true;
    }

    collapse(el, rule) {
      el.style.setProperty('display', 'none', 'important');
      const ph = document.createElement('div');
      ph.className = 'aiblock-placeholder';
      ph.textContent = `AI content hidden (${rule.label}) — show`;
      ph.style.cssText =
        'all:revert;font:12px/1.4 system-ui,sans-serif;color:#555;background:#f3f4f6;' +
        'border:1px solid #e5e7eb;border-radius:8px;padding:6px 10px;margin:6px 0;' +
        'cursor:pointer;display:block;';
      ph.addEventListener(
        'click',
        () => {
          el.style.removeProperty('display');
          ph.remove();
        },
        { once: true }
      );
      el.parentElement?.insertBefore(ph, el);
    }

    // --- slop-domain badge -------------------------------------------------

    maybeSlopBadge(settings) {
      if (!settings.slopBadge) return;
      if (!hostMatches(this.host, ns.slopDomains || [])) return;
      const make = () => {
        if (!document.body || document.getElementById('aiblock-slop-badge')) return;
        const b = document.createElement('div');
        b.id = 'aiblock-slop-badge';
        b.textContent = '⚠ Flagged as AI-generated content';
        b.title = 'Dismiss';
        b.style.cssText =
          'position:fixed;z-index:2147483647;bottom:12px;right:12px;' +
          'font:12px system-ui,sans-serif;color:#7c2d12;background:#ffedd5;' +
          'border:1px solid #fdba74;border-radius:999px;padding:6px 12px;' +
          'box-shadow:0 1px 4px rgba(0,0,0,.15);cursor:pointer;';
        b.addEventListener('click', () => b.remove(), { once: true });
        document.body.appendChild(b);
      };
      if (document.body) make();
      else document.addEventListener('DOMContentLoaded', make, { once: true });
    }
  }

  ns.Engine = Engine;
})();
