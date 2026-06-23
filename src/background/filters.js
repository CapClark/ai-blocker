// Pure filter-list sanitizer (no chrome APIs) so it's unit-testable.
//
// Remote filter lists are *data*, not code (MV3 forbids remote code). This
// strictly coerces fetched JSON into the exact shapes the engine understands
// and drops anything malformed, so a hostile or broken list can at worst hide
// the wrong element — never run code.

const CATEGORIES = ['search', 'social', 'shopping', 'productivity'];

export function sanitizeRule(r) {
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
          upClosest: typeof t.upClosest === 'string' ? t.upClosest : undefined,
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

export function sanitizeList(json) {
  const cosmetic = Array.isArray(json?.cosmetic)
    ? json.cosmetic.map(sanitizeRule).filter(Boolean)
    : [];
  const slopDomains = Array.isArray(json?.slopDomains)
    ? json.slopDomains.filter((d) => typeof d === 'string').map((d) => d.toLowerCase())
    : [];
  return { cosmetic, slopDomains };
}
