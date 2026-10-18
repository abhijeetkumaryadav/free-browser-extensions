# Highlight Vault — Notion-ready Exporter (v1.0.0)

Your personal book-highlights vault. Save quotes with book, page, tag, and your own
notes, search everything locally, and export clean Markdown that you import into
Notion yourself.

## Honest scope

**No Notion API. No sync.** This extension does not connect to Notion, and it never
makes network requests. The export buttons produce a Markdown file you copy or
download and then import manually (in Notion: Settings → Import → Text & Markdown).

## Features

- Add highlights: book title, page number, tag, quote, your note
- Case-insensitive search across book, quote, note, and tag
- Live Markdown preview that updates as you add/delete highlights
- Copy to clipboard or download as `.md`
- All data in `chrome.storage.local` — private, on-device, zero network
- 1000-highlight cap to keep storage sane

## Permissions

- `storage` — store your highlights locally.

## Files

- `manifest.json` — MV3 manifest
- `popup.html` / `popup.css` / `popup.js` — popup UI; core engine between `// ENGINE-START` and `// ENGINE-END` in `popup.js`
- `icons/` — generated PNG icons (16/48/128)
