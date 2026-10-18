# Satellite Decay Tracker

A manual satellite orbital-decay list: add satellites with an estimated decay
date, see a countdown per satellite, and browse upcoming/past lists.

## Honest scope
- **Your entries only** — this extension has no network access and does not
  query any live satellite catalog (SatCat, CelesTrak, Space-Track, etc.).
- Dates are your estimates; the countdown is simple date math, not a real
  orbital decay prediction.
- Nothing leaves the browser; entries persist in `chrome.storage.local`.

## Files
- `manifest.json` — MV3, `storage` permission only
- `popup.html` / `popup.css` / `popup.js` — UI + engine
- `icons/icon{16,48,128}.png`

## Permissions
- `storage` — persist your satellite list locally.
