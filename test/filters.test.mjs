import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { sanitizeList } from '../src/background/filters.js';

const here = dirname(fileURLToPath(import.meta.url));

test('accepts the live.json subscription as 2 valid rules', () => {
  // The actual file the extension fetches by default.
  const json = JSON.parse(readFileSync(join(here, '..', 'filters', 'live.json'), 'utf8'));
  const out = sanitizeList(json);
  assert.equal(out.cosmetic.length, 2);
  const ids = out.cosmetic.map((r) => r.id);
  assert.deepEqual(ids, ['google-ai-overview-live', 'google-ai-mode-live']);
  // upClosest survives sanitization (the durable-climb field)
  assert.equal(out.cosmetic[0].text[0].upClosest, 'div[data-mcpr]');
  assert.deepEqual(out.cosmetic[1].css, ['a[href*="udm=50"]']);
});

test('drops malformed rules (missing id / no hosts / no selectors)', () => {
  const out = sanitizeList({
    cosmetic: [
      { label: 'no id', hosts: ['x.com'], css: ['a'] }, // missing id
      { id: 'no-hosts', hosts: [], css: ['a'] }, // empty hosts
      { id: 'no-selectors', hosts: ['x.com'] }, // neither css nor text
      { id: 'keep', hosts: ['x.com'], css: ['a'] }, // valid
    ],
  });
  assert.equal(out.cosmetic.length, 1);
  assert.equal(out.cosmetic[0].id, 'keep');
});

test('coerces unknown category to search and filters non-string css', () => {
  const out = sanitizeList({
    cosmetic: [{ id: 'r', category: 'news', hosts: ['x.com'], css: ['a', 123, null] }],
  });
  assert.equal(out.cosmetic[0].category, 'search');
  assert.deepEqual(out.cosmetic[0].css, ['a']);
});

test('lowercases slop domains and ignores non-strings', () => {
  const out = sanitizeList({ slopDomains: ['BadSite.COM', 42, 'x.example'] });
  assert.deepEqual(out.slopDomains, ['badsite.com', 'x.example']);
});

test('returns empty result for non-array / null input', () => {
  assert.deepEqual(sanitizeList(null), { cosmetic: [], slopDomains: [] });
  assert.deepEqual(sanitizeList({ cosmetic: 'nope' }), { cosmetic: [], slopDomains: [] });
});
