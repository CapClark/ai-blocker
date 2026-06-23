# AI Blocker

A Manifest V3 browser extension that hides **AI product surfaces** (Google AI
Overviews, Bing Copilot answers, X Grok, Meta AI, LinkedIn collaborative
articles, Amazon AI review summaries, Gmail Gemini…), **labels or blurs images
declared AI** in their metadata (C2PA Content Credentials, IPTC
DigitalSourceType, AI software tags), and flags pages on an "AI slop" domain
list.

This is the **Ring 1–2 MVP**: deterministic and provenance-based blocking only.
It does *not* statistically detect AI-written text or guess AI from raw pixels —
that path is unreliable and is left as an opt-in layer (the offscreen pixel
classifier is stubbed, see below).

## Load it

1. Open `chrome://extensions` (or `edge://extensions`).
2. Toggle **Developer mode** on.
3. Click **Load unpacked** and select this folder.
4. Pin the extension. The toolbar badge shows how many items were hidden on the
   current tab; the popup has the per-site controls; **All settings →** opens the
   options page.

Requires Chrome/Edge 116+. After editing filters or settings code, hit the
**reload** ↻ button on the extensions page.

## How it works

| Layer | File | What it does |
|-------|------|--------------|
| Network block | `rules/dnr.json` | `declarativeNetRequest` static rules (template rule only — add real AI endpoints here) |
| Cosmetic filter list | `src/content/filters/cosmetic-filters.js` | Per-site CSS selectors + durable text-label heuristics |
| Slop domains | `src/content/filters/slop-domains.js` | Reputation list → floating "flagged" badge |
| Cosmetic engine | `src/content/engine.js` | Anti-flash style inject, `MutationObserver`, remove/collapse |
| Media scanner | `src/content/media-scanner.js` | `IntersectionObserver` over images → label/blur declared AI media |
| Provenance parser | `src/background/provenance.js` | Reads C2PA / IPTC / EXIF markers from image bytes |
| Bootstrap | `src/content/content.js` | Loads settings, reconciles, reacts to live changes |
| Worker | `src/background/service-worker.js` | Per-tab badge, image byte fetch + cache, offscreen ML hook |
| Classifier seam | `src/offscreen/offscreen.js` | Stub for an on-device WebGPU pixel model |
| UI | `src/popup/*`, `src/options/*` | Enable, per-site allowlist, surface action, image action, category toggles |

Detection is ordered cheap → expensive, and confidence drives the action:
when a rule **knows** something is an AI surface it removes it; declared-AI
images are labeled (or blurred); the slop list is a softer "flag, don't delete"
signal.

### How image detection works (tiered, cheapest first)

When an image nears the viewport (`IntersectionObserver`), the scanner runs:

1. **Contextual scan (tier 1.5)** — local, zero network. Checks alt text,
   `figcaption`, the src filename, and nearby links for AI-tool names / phrases
   (`media-scanner.js`). This is an *inference*, so it only ever labels with a
   soft amber **AI?** badge and never blurs.
2. **Provenance (tier 2)** — the worker fetches the leading 256 KB (where
   EXIF/XMP/C2PA markers live), scans the standardized markers in
   `provenance.js`, and caches the verdict per URL. Declared AI gets a red
   **AI** badge and can blur in Blur mode; C2PA-only gets a teal **CR**.

Declared provenance outranks context when both fire. Verdicts: `ai-generated`,
`ai-edited`, `ai-software`, `content-credentials`, `ai-context`, `none`.

Provenance is a fast **triage**, not cryptographic C2PA verification (that needs
the `c2pa` WASM SDK + signature checks). Neither tier guesses from pixels.

### Verify image (on-demand pixel check)

Right-click any image → **Verify image with AI Blocker**. The worker returns the
provenance verdict instantly, then runs the on-device pixel classifier in the
offscreen document and reports both back as an in-page toast. The classifier is
a labeled **stub** today — `offscreen.js` shows exactly where a Transformers.js /
ONNX Runtime Web model on WebGPU drops in. This is the deliberate place for the
expensive, lower-confidence check: explicit user intent, not every image.

## Try it on the test page

A self-contained page exercises both paths without hunting for real declared-AI
media in the wild:

```bash
python3 test/make_test_images.py   # generate PNGs with embedded AI markers
cd test && python3 -m http.server 8000
```

Open `http://localhost:8000/`. It has a mock AI Overview block (removed/collapsed
by the cosmetic engine) and eight images: five PNGs and two JPEGs carrying real
C2PA / IPTC / software markers (declared AI, red **AI** / teal **CR**), one
metadata-free image flagged by its Midjourney caption (context, amber **AI?**),
plus a normal result and a clean photo as no-false-positive controls. Right-click
any image to try **Verify image**. Serve over HTTP — `file://` can't have its
image bytes fetched. The `demo-ai-overview` rule in `cosmetic-filters.js` is
scoped to localhost and safe to delete.

## Tests

```bash
npm test               # parser assertions (synthetic strings + PNG/JPEG fixtures)
npm run build:fixtures # regenerate test/images/ if you change the markers
```

`test/provenance.test.mjs` runs against the real `provenance.js` via Node's
built-in test runner — no dependencies to install. It guards the tricky bits:
the composite-vs-generated ordering and the `algorithmicMedia` (CGI, not AI)
exclusion.

## Extending the filter list

Add a rule to `cosmetic-filters.js`:

```js
{
  id: 'site-feature',
  label: 'Human-readable name',
  category: 'search',           // search | social | shopping | productivity
  hosts: ['example.com'],       // matched with endsWith
  css: ['.selector-to-hide'],   // hidden immediately + counted
  text: [                       // durable fallback: match a visible label
    { contains: 'AI Overview', scope: 'h1,h2,[role="heading"]', maxLen: 24, up: 4 },
  ],
}
```

`css` selectors are the part that rots fastest (sites rename classes) — treat
this like an ad-block filter list. The `text` rules survive longer because they
key off the visible "AI Overview" / "Copilot" labels.

## Filter subscriptions (update without reinstalling)

Selectors rot, so the rules don't have to ship inside the extension. The service
worker fetches remote JSON filter lists daily (and on install/startup), strictly
**sanitizes** them into the shapes the engine understands, and caches them; the
content scripts merge them on top of the built-in rules. Lists are *data, never
code* — MV3 forbids remote code, and the sanitizer drops anything unexpected.

To use one: host a JSON file (GitHub raw, a gist, jsDelivr, Cloudflare Pages —
all free) in the shape of `filters/remote-example.json`, then paste its URL into
**options → Filter subscriptions** and hit **Update now**. The status line shows
when it last refreshed and how many rules/domains loaded.

This is what lets a list be community-maintained: fix a broken Google selector
once in the hosted file and every subscriber gets it on their next daily refresh.

## Publishing

```bash
npm run package   # builds dist/ai-blocker-v<version>.zip (runtime files only)
```

Then upload the zip:

- **Chrome Web Store** — one-time **$5** developer registration, then submit the
  zip at the [developer dashboard](https://chrome.google.com/webstore/devconsole).
  You'll need: 1+ screenshot, a short + long description, and a privacy
  disclosure. Use `PRIVACY.md` — this extension collects no data; the
  `<all_urls>` permission is justified as "run on-device blocking on every site
  and read image metadata."
- **Edge Add-ons** and **Firefox AMO** — free; the same zip works (Firefox may
  warn on the `offscreen` API, which is stubbed and unused).

Set `author` and `homepage_url` in `manifest.json` before submitting. Once
published, bumping `version` and re-uploading auto-updates every user.

## Regenerate icons

```bash
python3 scripts/make_icons.py
```

## Next layer (on-device pixel classification)

Provenance only catches *declared* AI. `service-worker.js` exposes
`classifyImage()`, which spins up the offscreen document and messages
`offscreen.js`. Drop an ONNX Runtime Web / TF.js model on the WebGPU backend
there to score raw pixels. Keep it **opt-in** and default to *labeling*, not
removing — statistical detectors have real false-positive costs.

## Known limitations

- Selectors need ongoing maintenance; this is an arms race, like ad blocking.
- Text heuristics can over-match; tune `maxLen` / `up` per site.
- Image provenance is a metadata *pre-filter*, not verified C2PA — and most
  platforms strip metadata on re-upload, so coverage is partial by nature.
- The contextual scan is a heuristic guess (label-only by design); tune
  `CONTEXT_TERMS` / `CONTEXT_HOSTS` in `media-scanner.js` to trade recall for
  fewer false positives.
- The "Verify image" pixel classifier is a stub — it reports the metadata
  verdict for real, but the pixel score stays 0 until a model is wired in.
- Wrapping an image to position its badge can shift unusual layouts; reversible
  on allowlist/disable.
- No statistical AI-text detection and no pixel-level image guessing
  (intentionally) — only known surfaces and declared signals are reliable.
