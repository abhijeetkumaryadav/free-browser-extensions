# Journey Terrain — Browsing Journal

Your personal journal of places you've visited on the web, drawn as a trail
across a 3D-style canvas terrain.

## What it does

- **Log places:** Save a site name, its URL, a short note, and the date you visited.
- **Terrain trail:** A canvas "3D-ish" isometric terrain doodle with a glowing trail
  connecting your entries in visit order.
- **Search & delete:** Case-insensitive search across site names and notes;
  per-entry delete; clear-all with confirm.
- **Export:** Download your journal as JSON or plain Markdown.

## What it does NOT do

This extension **never reads your browser history**. Every entry is one you
added yourself by hand. The terrain is a playful doodle, not a map of real data.

- 100% local. Zero network calls. Data stays in `chrome.storage.local`.
- MV3, `storage` permission only.
- No remote libraries, no analytics, no telemetry.

## Files

- `manifest.json` — MV3 manifest
- `popup.html` / `popup.css` / `popup.js` — 380px glassmorphism popup
  - Engine (between `// ENGINE-START` / `// ENGINE-END`): `makeEntry`,
    `sortEntries`, `filterEntries`, `terrainTrail`, `fmtDate`
- `icons/` — generated 16/48/128 PNG icons
- `README.md` — this file
