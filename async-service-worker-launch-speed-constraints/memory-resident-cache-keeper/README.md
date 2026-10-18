# CacheKeeper — Storage Usage Dashboard

An honest storage-usage dashboard. Click **Scan** to measure the current tab's origin
storage usage and quota (via `navigator.storage.estimate()` run in the tab's own
context), see a usage breakdown bar, keep a scan history, and clear that origin's cache
on demand.

## Install

**Chrome / Edge**
1. Unzip the package.
2. Open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

**Firefox** — MV3 with `browsingData` and MAIN-world scripting; not tested there yet.

**Opera** — load via `opera://extensions` the same way as Chrome.

## Permissions

- `storage` — saves your scan history on-device.
- `activeTab` — identifies the current tab's origin when you click Scan.
- `scripting` — runs the storage estimate inside the tab's own context (MAIN world) so
  the numbers reflect the site's origin, not the extension's. Injected only on click.
- `browsingData` — clears the **cache** for the scanned origin only, only when you click
  the button. Nothing is cleared automatically.

## Publishing notes

- Manifest V3, no remote code, no network calls, all data stays on-device.
- Store listing category: Developer Tools / Productivity. No privacy policy URL needed
  (no data collection).

## Honest scope

- Extensions **cannot** control the browser cache or prevent tabs from being discarded.
  This tool does not claim to. It is a read-only usage audit plus a user-initiated,
  origin-scoped cache clear.
- Usage numbers come from `navigator.storage.estimate()` and cover Cache, IndexedDB,
  and other site storage as one figure — the browser does not break it down further.
- `chrome://` and other internal pages cannot be scanned.
- For full site-data management, use `chrome://settings/siteData`.
