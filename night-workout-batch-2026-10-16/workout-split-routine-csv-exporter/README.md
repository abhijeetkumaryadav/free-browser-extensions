# Workout Split CSV Planner

A 100% local weekly workout-split planner for Chrome/Edge (Manifest V3). Organize training days → exercises (sets/reps/rest), then export the whole plan to CSV and import it back.

## Honest scope

- **Your plan** — this is a planner and logbook, not a coach. Not coaching or medical advice.
- CSV format: `day,exercise,sets,reps,rest` — one row per exercise, quoted where needed.
- No network, no accounts, no telemetry. Everything lives in `chrome.storage.local`.

## Install

1. Open `chrome://extensions`, enable **Developer mode**.
2. Click **Load unpacked** and select this folder.
3. Pin the extension and click the toolbar icon.

## Use

- Add/rename/delete training days; click a day chip to edit it.
- Add exercises with sets, reps, and rest; delete any row with ×.
- **Export CSV** downloads `workout-split.csv`; **Import CSV** replaces the plan (with confirmation).

## Files

- `manifest.json` — MV3 manifest, `storage` permission only
- `popup.html` / `popup.css` / `popup.js` — UI and logic (CSV helpers between `ENGINE-START`/`ENGINE-END` are headless-testable)
- `icons/` — generated 16/48/128 PNG icons
