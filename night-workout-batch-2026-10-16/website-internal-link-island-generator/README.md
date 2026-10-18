# Island Map — Link Atlas

Your saved links drawn as a canvas island map. Each link becomes an island;
islands you put in the same group are joined by bridges. Click an island to
open its page in a new tab.

## What it does

- **Add links:** Save a title, a URL, and a group name (e.g. "work", "reads").
- **Island map:** A canvas atlas with deterministic island positions; same-group
  islands are connected by bridges. Click an island to open its page.
- **Groups:** Filter the map by group; per-island delete; clear-all with confirm.
- **Search:** Case-insensitive search across titles, URLs, and groups.

## What it does NOT do

This extension **never crawls any website or extracts links from pages**.
Every link is one you added yourself by hand. The map is a playful atlas,
not a sitemap.

- 100% local. Zero network calls. Data stays in `chrome.storage.local`.
- MV3, `storage` permission only.
- No remote libraries, no analytics, no telemetry.

## Files

- `manifest.json` — MV3 manifest
- `popup.html` / `popup.css` / `popup.js` — 380px glassmorphism popup
  - Engine (between `// ENGINE-START` / `// ENGINE-END`): `makeLink`,
    `filterLinks`, `islandLayout`, `bridgePairs`, `islandAt`, `hostOf`
- `icons/` — generated 16/48/128 PNG icons
- `README.md` — this file
