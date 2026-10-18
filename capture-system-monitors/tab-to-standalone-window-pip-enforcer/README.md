# PopDock — Tab to Standalone Window

**v1.0.0** · One click pops the current tab out into its own standalone window —
full-size (maximized) or a compact video-friendly 640×360 window tucked near the
bottom-right of your screen. Optionally send the tab back to its original window.

## What it does
- **Pop out — same size:** moves the active tab into its own maximized window.
- **Pop out — compact video (640×360):** moves the tab into a small floating window,
  ideal for watching a video while you work.
- **Always use compact video size:** makes the primary button use the compact size too.
- **Send back to original window:** restores the last popped tab to the window it came from.
- Shows the current tab's title + site at the top of the popup.

## Honest scope
- Runs **only when you click a button** — nothing moves on its own, ever.
- Works on regular web pages (`http/https`), `file://`, and `ftp://` URLs.
- Restricted pages (`chrome://`, `edge://`, the Chrome Web Store, etc.) cannot be
  moved by any extension — the button shows a friendly error instead.
- Compact windows open at the OS default position (extension APIs can't read
  display geometry without extra permissions, so it keeps permissions minimal).

## Install
1. Unzip `tab-to-standalone-window-pip-enforcer.zip`.
2. Open `chrome://extensions` (Edge: `edge://extensions`), enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.
4. Pin PopDock to the toolbar for one-click popping.

Firefox: `windows.create({ tabId })` is not supported in Firefox — the extension
loads but the pop-out action will report an error. Chrome, Edge, and Opera are
fully supported.

## Permissions (justified)
- `tabs` — read the active tab's title/URL to show it in the popup.
- `storage` — remember your "compact default" preference and where to send a tab back.

## Privacy
Zero network calls. No analytics. Nothing leaves your device. All state lives in
`chrome.storage.local`.

## Files
- `manifest.json` — MV3 manifest
- `popup.html` / `popup.css` / `popup.js` — the popup UI and logic (commented, modular)
- `icons/icon{16,48,128}.png` — generated icons
- `README.md` — this file
