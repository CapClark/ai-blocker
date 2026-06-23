# Privacy policy

**AI Blocker does not collect, store, or transmit any personal data.**

Everything runs on your device:

- **Page scanning** (hiding AI surfaces, labeling AI media) happens locally in
  your browser. No page content is sent anywhere.
- **Image provenance checks** fetch the image's own bytes to read its metadata
  (C2PA / EXIF / XMP). Those bytes are read locally and discarded; nothing about
  them is uploaded.
- **Settings** (toggles, allowlist) are stored locally via `chrome.storage` and
  never leave your browser.
- **Filter subscriptions** are optional. If you add a subscription URL, the
  extension fetches that JSON list from the URL you chose, on a daily schedule.
  This is a normal outbound request to a server you selected; no data about your
  browsing is included in it.

There are no analytics, no tracking, no third-party servers, and no accounts.

The broad `<all_urls>` host permission is required only so the extension can run
its on-device blocking on every site and read image metadata; it is not used to
collect data.

_Contact: <your email>_
