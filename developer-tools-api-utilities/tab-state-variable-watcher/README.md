# Tab State Variable Watcher v1.0.0

A dev tool for inspecting live page state. Enter JS variable names
(e.g. `cart`, `appState`) and the extension reads `window[name]` on
the current tab — read-only, it never modifies page variables.
See current values (JSON, truncated) with type badges, read once on
demand, or start an auto-watch that polls every 2 seconds in the
background and logs every change with timestamps.

## Try it
1. Unzip `tab-state-variable-watcher.zip`.
2. Chrome/Edge: `chrome://extensions` → Developer mode → **Load unpacked** → select the folder.
   Firefox: `about:debugging` → This Firefox → **Load Temporary Add-on** → select `manifest.json`.
3. Open a site that sets globals (try the console: `cart = {items: 2}`),
   click the extension, add `cart`, then **Read now** or **Start auto-watch**.

## Permissions
- `activeTab` + `scripting`: read the current tab's JS variables when you ask. Page state is never written to.
- `storage`: watch list, latest snapshots, and change history — all on-device.

## Publishing notes
- Chrome Web Store: $5 one-time developer registration. Minimal, justified permissions.
