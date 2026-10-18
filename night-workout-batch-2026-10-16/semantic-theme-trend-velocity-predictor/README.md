# Theme Velocity

Track the momentum of themes and trends from **your own observations** — not live trend data.

## What it does

- **Log observations** — theme name, date, mention count, and an optional note.
- **Velocity** — computes mentions/week per theme over the last 4 weeks from your logs.
- **Chart** — weekly mention totals across the last 8 weeks (CSS bar chart).
- **Theme list** — ranked by velocity with per-theme removal; full clear-all.

## Honest scope (read the label in the popup)

This is a manual logbook. There is no live trend data source available to a browser extension, and nothing here predicts the future. Every number comes from observations **you** typed. Velocity = your mentions ÷ 4 weeks. Empty results mean you haven't logged anything in the window.

## Privacy

100% local. All data lives in `chrome.storage.local`. Zero network requests.

## Permissions

- `storage` — persist your observation log.

## Install

1. Open `chrome://extensions`, enable Developer mode.
2. "Load unpacked" → select this folder.

## Files

- `manifest.json` — MV3 manifest
- `popup.html` / `popup.css` / `popup.js` — UI and trend math
- `icons/` — generated PNG icons
