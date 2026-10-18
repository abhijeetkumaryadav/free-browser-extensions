# 404 Snapshot Log — Broken-Link Reviver

Keep your own log of broken (404 / dead) links, with your notes, and open
archive.org snapshot lookups in a new tab when **you** click.

## What it does

- Save broken URLs with a title and your own note.
- "Snapshot" opens `web.archive.org/web/<url>` in a new tab — your click, your tab.
- Search across URLs, titles, and notes.
- Newest-first, per-entry delete. Your data stays on your device.

## What it does NOT do

- Your log — **not live revival**. Nothing is fetched automatically.
- The extension itself makes **zero network calls**. Archive links are plain
  URLs you choose to open.

## Files

- `manifest.json` — MV3 manifest, `storage` permission only
- `popup.html` / `popup.css` — deep-dark glassmorphism popup, single teal accent
- `popup.js` — engine between `ENGINE-START` / `ENGINE-END`

## Validation

- `manifest.json` parses, MV3
- 16/48/128 PNG icons present
- `node --check` passes on all JS files
- `manifest.json` at zip root
