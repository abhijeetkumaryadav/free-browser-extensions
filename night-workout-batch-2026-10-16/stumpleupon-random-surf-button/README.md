# Stumble Button — Random Surfer v1.0.0

A retro random-surf button for your own curated list of sites.

## Honest scope

Stumbles **your** list only — this is not the StumbleUpon service, and it has no connection to it. You build the list of sites yourself; the big button opens a random one.

## Features

- Big **Stumble!** button opens a random URL from your list in a new tab.
- Add URLs with optional categories (datalist suggestions from your existing categories).
- Category filter dropdown to stumble within one category.
- Per-site delete; duplicate URLs rejected; only `http(s)` URLs accepted.
- Stumble history (last 20, newest first, with timestamps) + clear history.
- Everything stored in `chrome.storage.local`. Zero network calls.

## Permissions

- `storage` — persist your site list and history locally.
- `tabs` — open the stumbled URL in a new tab.

## Files

- `manifest.json` — MV3 manifest
- `popup.html` / `popup.css` / `popup.js` — popup UI and logic
- `icons/` — generated PNG icons (16/48/128)
- `README.md` — this file
