# ExtSort — Download Extension Sorter

**v1.0.0** · A read-only viewer for your browser's download history: browse,
search, sort, and group recent downloads by file extension with per-extension
counts and total sizes.

## What it does
- **Stats row:** total downloads, combined size, and number of distinct extensions.
- **Search:** filter by filename as you type.
- **Sort:** newest/oldest first, largest first, or name A–Z (preference remembered).
- **Extension chips:** one click filters the list to a single extension (e.g. `.pdf`);
  each chip shows its count and total size on hover.
- **Download rows:** file name, size, download date, and a badge for the extension.
- **Refresh button:** reload the list.

## Honest scope
- **Read-only.** ExtSort never moves, renames, deletes, or opens files — it can't:
  browsers don't let extensions move files on your disk.
- Shows the last 500 downloads (browser API page limit).

## Install
1. Unzip `download-manager-file-extension-sorter.zip`.
2. Open `chrome://extensions` (Edge: `edge://extensions`), enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.
4. Pin ExtSort to the toolbar for quick access.

Works in Chrome, Edge, and Opera. Firefox supports the `downloads` API read
methods used here, so the viewer should work there too.

## Permissions (justified)
- `downloads` — read (search only) your download history to display it.
- `storage` — remember your sort preference.

## Privacy
Zero network calls. No analytics. Nothing leaves your device. Everything runs
locally in the popup.

## Files
- `manifest.json` — MV3 manifest
- `popup.html` / `popup.css` / `popup.js` — the popup UI and logic (commented, modular)
- `icons/icon{16,48,128}.png` — generated icons
- `README.md` — this file
