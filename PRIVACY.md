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
- **Filter subscriptions.** By default the extension fetches one filter list
  (`filters/live.json` from the project's public GitHub repo) once a day to keep
  selectors current. You can remove it or add your own in the options page. This
  is a plain outbound request for a static file; it includes no data about your
  browsing, and you can disable it.

There are no analytics, no tracking, no third-party servers, and no accounts.

The broad `<all_urls>` host permission is required only so the extension can run
its on-device blocking on every site and read image metadata; it is not used to
collect data.

_Contact: <your email>_
