# Network Request Logger

A read-only network inspector for the current tab. See every request a page
makes — method, URL, type, status code, size and timing — with type filters,
URL search, and JSON export.

## What it does

- Captures requests for the **active tab only** via non-blocking
  `webRequest` listeners (method, URL, type, status, content-length, timing).
- Filter by request type (XHR, JS, CSS, Img, Font, Media, Doc) and search by
  URL or method.
- Stats line: request count, failed count, total transferred bytes.
- Export the visible log as JSON. Clear per-tab logs with one click.
- **Read-only by design:** listeners never block, cancel or modify traffic.

## Honest limitations

- The background service worker can sleep between events; listeners wake it,
  so capture is normally complete, but a request landing in the exact
  shutdown/restart instant may be missed.
- Logs are kept in memory per tab (newest 400) and dropped when the tab
  closes. Nothing is persisted or sent anywhere.

## Install (development)

**Chrome / Edge:**
1. Unzip `network-request-logger.zip`.
2. Open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
3. **Load unpacked** → select the unzipped folder.

**Firefox:**
1. Open `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on**.
2. Select `manifest.json` inside the unzipped folder.
3. Note: temporary add-ons unload on browser restart.

## Permissions (minimal, justified)

| Permission | Why |
|---|---|
| `webRequest` | Observe request metadata (method, URL, status, size). Non-blocking listeners only. |
| `host_permissions: <all_urls>` | Required by `webRequest` to observe requests on any site you visit. No data is collected off-device. |
| `storage` | Reserved for future settings; the log itself stays in memory. |

## Privacy

All processing is on-device. No analytics, no network calls, nothing leaves
your machine.

## Publishing notes

- Chrome Web Store: one-time $5 developer registration; declare the
  `webRequest` + host permission usage in the privacy section ("observes
  network metadata locally, read-only").
- Edge Add-ons: similar disclosure; free account.
- Firefox Add-ons (AMO): source review may ask why `<all_urls>` host access
  is needed — answer: webRequest observation on user-visited pages, local only.
