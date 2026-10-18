# GeoCities Webring — Random Resurrector

A fun retro tool: keep your own list of retro / vintage-style websites, and hit
**"Surprise me"** to open a random one in a new tab.

## What it does

- Save sites: name, URL, and your own note.
- "Surprise me" opens a random site from your list in a new tab.
- Search your list by name, URL, or note.
- Open or delete any entry. Your data stays on your device.

## What it does NOT do

- Your list — **not** a live webring. You add every site yourself.
- Random opener — it does not discover, crawl, or fetch anything.
- Zero network calls. Everything lives in `chrome.storage.local`.

## Files

- `manifest.json` — MV3 manifest, `storage` permission only
- `popup.html` / `popup.css` — deep-dark glassmorphism popup, single retro-amber accent
- `popup.js` — engine between `ENGINE-START` / `ENGINE-END`

## Validation

- `manifest.json` parses, MV3
- 16/48/128 PNG icons present
- `node --check` passes on all JS files
- `manifest.json` at zip root
