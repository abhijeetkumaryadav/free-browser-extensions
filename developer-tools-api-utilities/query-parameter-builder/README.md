# Query Parameter Builder v1.0.0

Build URLs with query params without hand-encoding: type a base URL,
add key/value rows, toggle rows in or out, and watch a live
URL-encoded preview update as you type. One-click **Copy URL** or
**Open in tab**. **Parse mode**: paste any full URL to split its
query string into editable rows. Your last draft is remembered
on-device.

## Try it
1. Unzip `query-parameter-builder.zip`.
2. `chrome://extensions` → Developer mode → **Load unpacked** → select the folder.
3. Click the toolbar icon, add params, copy the URL.

Firefox: `about:debugging` → This Firefox → Load Temporary Add-on → pick `manifest.json`.
Edge: `edge://extensions` → same Load unpacked flow.

## Permissions
- `storage` — remembers your last base URL and param rows on this device. Nothing is uploaded anywhere.

## Publishing notes
- Chrome Web Store: $5 one-time developer registration.
- No remote code, no network calls, no page access — store review friendly.
