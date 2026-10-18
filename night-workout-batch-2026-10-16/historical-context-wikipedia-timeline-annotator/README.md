# Timeline Journal — Historical Events & Wikipedia Links

A personal historical timeline journal. **Your timeline — manual.** You add the events with dates and notes; each event gets a Wikipedia search link that opens in a new tab for you to read. The extension itself makes no network calls — only the Wikipedia tab you open.

## Features
- Add events: date, title (required), notes (optional, 500 chars).
- Timeline sorted oldest → newest, with human-friendly dates ("9 Nov 1989").
- Per-event **Wikipedia** button opens a Wikipedia search for that title.
- Search across titles and notes; per-event delete; clear-all with confirm.
- Everything persists in `chrome.storage.local`.

## Privacy
- Fully local. No analytics, no network calls by the extension.

## Permissions
- `storage` — saves your events locally.

## Files
- `manifest.json` — MV3 manifest
- `popup.html` / `popup.css` / `popup.js` — UI + engine (`makeEvent`, `sortEvents`, `filterEvents`, `wikiSearchUrl`, `fmtDate` between `// ENGINE-START` / `// ENGINE-END`)
- `icons/` — 16/48/128 PNG icons

## Install (developer mode)
1. Open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
2. **Load unpacked** → select this folder.
3. Click the toolbar icon and start your timeline.

Works in Chrome, Edge, Firefox, and Opera (MV3).
