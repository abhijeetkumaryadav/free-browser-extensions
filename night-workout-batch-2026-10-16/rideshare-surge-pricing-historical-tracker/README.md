# SurgeLog — Manual Ride Surge Journal

A personal journal for rideshare fares and surge pricing.

## What it does

- **Log rides** — date, time, app, route, base fare, surge multiplier, paid fare (auto-computed as base × surge if left blank), and notes.
- **Stats dashboard** — ride count, average surge, max surge, total spent.
- **Patterns** — average surge by hour of day and by weekday, rendered as bar charts from your own logs.
- **Ride log** — full history with per-ride delete.
- **CSV export** — one click to download all your data.

## Honest scope

This is a **manual logbook only**. There is no live rideshare pricing API available to a browser extension, so SurgeLog does not fetch, track, or predict real prices. Every trend and average shown comes from rides you entered by hand. All data stays in your browser's `chrome.storage.local` — nothing leaves the device.

## Permissions

- `storage` — save your ride logs locally. That's the only permission requested.

## Files

`manifest.json`, `popup.html`, `popup.css`, `popup.js`, `icons/`, `README.md`
