# Launch Velocity Tracker

Manual launch-day logbook for your browser. Log your upvotes, comments, and rank snapshots with timestamps; the extension charts the trajectory and computes **per-hour velocity** between your own entries.

## Honest scope

- **Your logged data only — NOT live Product Hunt data.** There is no Product Hunt API connection and none is possible here; every point on the chart is typed by you.
- 100% local: `chrome.storage.local` only. Zero network. No remote libraries.

## Features

- Log snapshots: upvotes, comments, optional rank, timestamp (defaults to now)
- Stats: total upvotes, latest velocity/hr, peak velocity/hr, latest rank
- Canvas chart of upvotes (orange) and comments (blue) over time
- History list with per-snapshot velocity badges and delete; clear-all

## Files

- `manifest.json` — Manifest V3
- `popup.html` / `popup.css` / `popup.js` — UI and logic
- `README.md` — this file
- `icons/` — 16/48/128 PNG icons

## Install

Load as an unpacked extension in Chrome/Edge (Developer mode → Load unpacked), or install the `.zip` in Firefox via `about:addons` → Install Add-on From File after signing.
