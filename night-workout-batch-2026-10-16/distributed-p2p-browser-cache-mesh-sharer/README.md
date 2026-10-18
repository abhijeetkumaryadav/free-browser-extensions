# Tab Relay — Cross-Tab File & Text Relay

Send text and files **between your own open tabs and windows**, instantly.

## What it does

- **Text tab:** send text snippets — they land in every open tab's popup; copy any received text back to the clipboard; "Copy latest" grabs the newest snippet
- **File tab:** pick a file (up to 2 MB), send it — every tab can download it via the history entry (downloads use the normal Save dialog)
- **Transfer queue + history:** newest-first list with previews, timestamps, per-entry download/copy and delete, clear-all with confirm
- **Live sync:** transfers appear in all open popups the moment they're sent (`chrome.storage.onChanged`), marked with a "live" indicator
- Ctrl/Cmd+Enter sends text from the input field

## Honest scope

- **Your own tabs only — not distributed P2P.** There is no peer-to-peer network, no browser-cache sharing, and no server. Transfers travel through this browser's local extension storage only.
- Files are capped at 2 MB so they fit within storage quotas; larger transfers are refused with a message.
- 100% local. No network access, no analytics, no accounts.

## Permissions

- `storage` — the relay queue shared across tabs (justified: the core feature)
- `downloads` — save received files through the normal Save dialog (justified: file delivery)

## Files

- `manifest.json` — MV3 manifest
- `popup.html` / `popup.css` / `popup.js` — popup UI, styling, and relay logic
- `icons/` — generated 16/48/128 PNG icons

## Development build

Install via `chrome://extensions` → Developer mode → Load unpacked.
