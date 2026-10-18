# Session Storage Wiper v1.0.0

One-click site data cleaner. Wipe cookies, cache, storage and more for the current
site — or across all sites — with a strict two-step confirmation. Nothing happens
until you explicitly confirm.

## What it does

- Detects the current tab's origin and shows a live cookie count for the site.
- Checkboxes for each data type: cookies, cache, local storage, IndexedDB,
  service workers, cache storage.
- **Wipe this site** — removes only the checked types for the current origin
  (`chrome.browsingData.remove` with an origins filter).
- **Wipe all sites** — removes the checked types everywhere (signs you out almost
  everywhere; separately confirmed).
- Two-step confirm on both actions: the button arms for 5 seconds, then disarms.
- Honest note: `sessionStorage` is per-tab by design — closing the tab clears it;
  the wiper covers the persistent stores.

## Install

**Chrome / Edge**
1. Unzip `session-storage-wiper.zip`.
2. Open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
3. **Load unpacked** → select the unzipped folder.

**Firefox** — temporary load via `about:debugging#/runtime/this-firefox`
(`browsingData` origins filtering is supported in modern Firefox).
**Opera** — same steps as Chrome via `opera://extensions`.

## Permissions (all justified)

| Permission | Why |
|---|---|
| `browsingData` | Remove the selected data types (the core feature) |
| `cookies` | Count cookies for the current site before wiping |
| `activeTab` | Read the current tab's URL to derive its origin |
| `storage` | Reserved for future preferences (currently unused beyond API availability) |

## Privacy

No data is read, stored, or transmitted. The extension only deletes data you
explicitly choose to delete.

## Publishing notes

- Manifest V3, no remote code, no deprecated APIs.
- Destructive capability is gated behind two-step confirmation and is strictly
  user-initiated — appropriate for store review with clear listing copy.
