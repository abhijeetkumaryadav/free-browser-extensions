# Link Galaxy — Your Links as a Solar System

**Your links only — nothing here extracts links from web pages.** There is no
page link extraction, no scraping, no network. You add the links; the
extension draws them as planets orbiting a star on a canvas galaxy. Click a
planet (or its list entry) to open the page.

## What it does

- **Galaxy canvas** — up to 8 of your saved links orbit a star with
  perspective-flattened orbits; inner planets move faster. Click a planet to
  open its page in a new tab.
- **Add links** — title + URL (http/https only), newest first.
- **Your list** — search titles/URLs, remove entries, shows host per entry.
- Everything persists in `chrome.storage.local` (500-entry cap).

## Permissions

- `storage` — save your link list locally. That's it.

## Privacy

Fully local. Zero network calls. No analytics, no telemetry.

## Files

- `manifest.json` — Manifest V3 config
- `popup.html` / `popup.css` / `popup.js` — popup + canvas engine
  (`orbitPositions`, `planetAt`, `makeLink`, `filterLinks` between
  `// ENGINE-START` / `// ENGINE-END`)
- `icons/` — 16/48/128 PNG icons
- `README.md` — this file
