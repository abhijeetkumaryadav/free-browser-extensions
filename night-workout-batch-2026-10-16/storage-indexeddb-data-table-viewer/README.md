# Storage Inspector — Self Storage Viewer

Shows **this extension's own** `chrome.storage.local` contents as a searchable
table, with per-key delete, JSON export, and JSON import.

## Honest scope

Browsers deliberately isolate each extension's storage: **no API can read
another extension's or a website's storage.** This tool inspects only itself —
useful when you're debugging your own extension, or curious what an
extension keeps locally.

## Use

- **Search keys** — filters the table as you type.
- **Delete** — removes one key (immediate, no undo).
- **Refresh** — reloads from storage.
- **Export** — downloads `extension-storage-export.json`.
- **Import** — loads an exported JSON object back into storage (keys are
  overwritten, nothing else is touched).

The header shows the key count and an approximate byte usage.

## Files

`manifest.json` · `popup.html` · `popup.css` · `popup.js` · `icons/`
· `README.md`

## Privacy

100% local. No network calls, no analytics, no data leaves the machine.
