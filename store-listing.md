# Chrome Web Store listing — copy/paste

Upload `dist/ai-blocker-v0.1.0.zip` (also attached to the v0.1.0 GitHub release).

## Single purpose
Hide AI-generated content and AI product features (AI Overviews, Copilot, Grok,
Meta AI, etc.) from web pages, and label AI-generated images.

## Summary (≤132 chars)
Hide AI Overviews, Copilot, Grok and other AI features, and flag AI-generated
images — all on-device, fully configurable.

## Category
Tools (or Productivity)

## Detailed description
AI Blocker removes AI product surfaces from the sites you use and flags AI media,
so your search results, feeds, and pages stay human.

What it does:
• Hides AI surfaces — Google AI Overviews & AI Mode, Bing Copilot answers,
  X Grok, Meta AI, LinkedIn collaborative articles, Amazon AI review summaries,
  Gmail "Help me write".
• Labels or blurs AI images that declare themselves in metadata (C2PA Content
  Credentials, IPTC, EXIF), and flags AI-gallery sites.
• Right-click "Verify image" for an on-demand check.
• Fully configurable: per-site allowlist, per-category toggles, remove/collapse,
  label/blur.

Everything runs on your device. No accounts, no tracking, no data collection.
Filter rules update from a public list so selectors stay current.

## Permission justifications (Privacy practices tab)
- Host permission `<all_urls>`: Run the on-device content filter on any site the
  user visits, and read image metadata (C2PA/EXIF/XMP) to label AI media. No page
  content or browsing data is collected or transmitted.
- `storage`: Store the user's settings, allowlist, and cached filter list locally.
- `declarativeNetRequest`: Block requests to known AI-feature endpoints via static
  rules.
- `offscreen`: Host the optional on-device image classifier (WebGPU); used only
  for the user-initiated "Verify image" action.
- `alarms`: Schedule a once-daily refresh of the filter list.
- `contextMenus`: Add the "Verify image" right-click menu item.

## Remote-resource / remote-code justification
The extension fetches one static JSON filter list (data, not code) from a public
URL once per day to keep selectors current. No user or browsing data is sent in
that request. The list is strictly sanitized into predefined rule shapes; no
remote code is executed (complies with Manifest V3).

## Data usage declarations
- Does NOT collect or use user data.
- Does NOT sell or transfer user data to third parties.
- Does NOT use data for purposes unrelated to the single purpose.
(Certify all three.)

## Privacy policy URL
https://github.com/CapClark/ai-blocker/blob/main/PRIVACY.md
(Fill the contact email in PRIVACY.md first.)

## Visibility
Unlisted (anyone with the link can install; not shown in search).

## Assets you still need to make
- At least 1 screenshot, 1280×800 or 640×400 (PNG/JPEG). Good options: the popup
  on a Google results page, or a before/after of an AI Overview.
- The 128×128 icon is already in the package.
