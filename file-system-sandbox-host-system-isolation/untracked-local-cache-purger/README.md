# CachePurge — Per-Origin Data Purger

See how much storage each site uses and purge cache, cookies, localStorage, IndexedDB, service workers, and cache storage **per origin** — only the origins you select, only after you confirm.

## Install

**Chrome / Edge:**
1. Unzip the package.
2. Go to `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

**Firefox:** this build targets Chromium's `chrome.browsingData.remove({origins})` API; Firefox support is best-effort (per-origin removal may behave differently). Load via `about:debugging` → This Firefox → Load Temporary Add-on.

## Use

1. Open the popup on any site and click **Scan this origin** to measure its storage usage (via `navigator.storage.estimate()` in the page's own context). The origin is added to your tracked list.
2. Or type any `https://…` URL and click **Add** to track it manually.
3. Tick the checkboxes for the origins you want to clean.
4. Choose data types (Cache, Cookies, Local storage, IndexedDB, Service workers, Cache storage).
5. Click **Purge selected** — a confirmation modal lists exactly what will be deleted. Nothing happens until you press **Delete now**.

## Permissions (justified)

- `storage` — persist your tracked-origin list on-device.
- `browsingData` — remove the data types you select, scoped to the origins you select. Nothing else is touched.
- `activeTab` + `scripting` — run a one-shot storage estimate in the current tab's page context when you click "Scan this origin". No page content is read or stored.

## Honest scope

- Storage usage can only be measured for the **currently open tab** (the WebExtensions API only exposes `navigator.storage.estimate()` inside an origin's own context). Other tracked origins show "usage unknown" until you open them.
- Purging is scoped per origin via `chrome.browsingData.remove({origins})`; some browsers may fall back to broader removal — the confirmation modal always states what will be deleted.
- No data leaves your device. Nothing is scanned, tracked, or deleted automatically.

## Publishing notes

- Chrome Web Store: single-purpose, minimal permissions; the `browsingData` permission triggers a review — describe the per-origin confirmation flow in the privacy justification.
- No remote code, no analytics, no network calls of any kind.
