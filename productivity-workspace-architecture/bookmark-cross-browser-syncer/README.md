# Bookmark Cross-Browser Syncer v1.0.0

Bookmark backup & portability, all on-device. See live stats
(total bookmarks, folders, empty folders worth tidying), export
everything to portable **JSON** and **Netscape HTML** (importable by
Chrome, Edge, Firefox, Opera, Safari…), and import backups back —
into a dated folder, with automatic duplicate detection so the same
URL is never added twice.

## Try it
1. Unzip `bookmark-cross-browser-syncer.zip`.
2. Chrome/Edge: `chrome://extensions` (or `edge://extensions`) → Developer mode → **Load unpacked** → select the folder.
3. Firefox: `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → pick `manifest.json`.
4. Click the icon → **Export HTML**, then import that file in any other browser's bookmark manager.

## Permissions
- `bookmarks` — read your bookmarks for stats/export, and create
  the dated import folder. Nothing leaves your machine.

## Publishing notes
- Chrome Web Store: $5 one-time developer registration. Justify the
  `bookmarks` permission as backup/import in the listing.
- Firefox Add-ons: free account; must pass Mozilla signing.
