# TabTree — Sidebar Tab Hierarchy Previewer

**What it does:** Shows every open tab as a vertical hierarchy tree inside Chrome's side panel —
grouped by **window**, then by **domain** — with live updates.

- **Search** filters tabs by title or URL as you type
- **Click a tab** to switch to it (focuses its window too)
- **✕** on hover closes the tab
- **Expand / Collapse** all window groups; collapsed state persists
- The active tab is highlighted with the accent border

**Permissions (minimal, justified):**
- `tabs` — read tab titles/URLs/favicons and switch/close tabs on your explicit click
- `sidePanel` — render the tree in the browser sidebar
- `storage` — remember which window groups you collapsed

100% local. Nothing is read from pages, nothing leaves your device.

## Install (developer mode)
1. Open `chrome://extensions`, enable **Developer mode**
2. **Load unpacked** → select this folder
3. Click the TabTree toolbar icon → **Open sidebar**

## Files
- `manifest.json` — MV3 manifest
- `popup.html/css/js` — launcher card with live tab/window counts
- `sidepanel.html/css/js` — the hierarchy tree (Window → Domain → Tabs)
- `icons/` — generated 16/48/128 PNG icons

## Notes
- Tested logic: manifest parses, JS passes `node --check`, icons verified.
- Not tested in a live browser; development build.
