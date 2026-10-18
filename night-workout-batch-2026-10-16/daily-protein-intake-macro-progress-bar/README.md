# Daily Protein & Macro Tracker

A 100% local macro logbook for Chrome/Edge (Manifest V3). Set daily protein/carb/fat targets, log meals with gram amounts, and watch progress bars plus a calorie estimate. Day history is kept for the last 14 days.

## Honest scope

- **You enter the numbers** — this is a logbook, not a nutrition coach. Not medical advice.
- Calorie estimates use the standard Atwater factors (protein 4, carbs 4, fat 9 kcal/g).
- No network, no accounts, no telemetry. Everything lives in `chrome.storage.local`.

## Install

1. Open `chrome://extensions`, enable **Developer mode**.
2. Click **Load unpacked** and select this folder.
3. Pin the extension and click the toolbar icon.

## Use

- Click **Edit** to set your daily targets (grams).
- Log meals with a name and P/C/F grams — bars and the kcal estimate update instantly.
- Delete individual meals, clear the day, or wipe past-day history from the UI.

## Files

- `manifest.json` — MV3 manifest, `storage` permission only
- `popup.html` / `popup.css` / `popup.js` — UI and logic (helpers between `ENGINE-START`/`ENGINE-END` are headless-testable)
- `icons/` — generated 16/48/128 PNG icons
