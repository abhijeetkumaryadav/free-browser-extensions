# ShatterPlay — Dynamic Page Shatter Impact Game

Shatter any web page into falling glass shards with real canvas physics. Click shards mid-air for **+10 points** each, chase your best score, and restore the page instantly.

## How it works

1. Click the extension icon, then **Shatter this page**.
2. The popup snapshots the visible tab (`chrome.tabs.captureVisibleTab`) and hands the image to an on-demand content script.
3. The screenshot is sliced into hundreds of triangular shards that burst outward from the impact point with velocity, gravity, rotation, and fade.
4. Click falling shards to smash them for points (spark burst included).
5. **Restore page** (or press `Esc` on the page) removes the overlay instantly.

**Honest scope:** the page DOM is never modified — everything happens on a full-viewport canvas overlay. When the overlay is removed, the page is exactly as it was.

## Permissions

| Permission | Why |
|---|---|
| `activeTab` | Snapshot + interact with the page you explicitly shatter |
| `scripting` | Inject the shatter engine only when you click Shatter |
| `storage` | Save your best score locally |

No network requests. No tracking. No data leaves your device.

## Notes

- Browser-internal pages (new tab, settings, Chrome Web Store) are protected by Chrome and cannot be shattered — the popup will tell you.
- Respects `prefers-reduced-motion`: shards drift and fade gently instead of flying.
- Best score is stored in `chrome.storage.local`.

## Install (developer mode)

1. Open `chrome://extensions`, enable **Developer mode**.
2. **Load unpacked** → select this folder (or drag in the `.zip` via "Load unpacked" after extracting).
3. Pin the extension, click it, and shatter away.
