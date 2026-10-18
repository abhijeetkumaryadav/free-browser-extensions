# Progressive Overload Logger

Personal lift logbook for tracking your training. 100% local — nothing leaves your browser.

## What it does

- **Log sets**: exercise name, weight, reps, and date. Weights are stored canonically in kg so the kg/lb toggle stays consistent.
- **Per-exercise volume chart**: session volumes (weight × reps summed per day) drawn as bars for the selected exercise.
- **PR badges**: heaviest set, most reps, best single-set volume, and total set count per exercise.
- **Set history**: grouped by exercise, newest first, with per-set delete.
- **kg/lb toggle**: one click converts all displayed weights.

## Honest scope

This is **your logbook — not coaching advice**. It records the numbers you enter and computes
simple volume statistics. It does not recommend programs, weights, or technique. Lift safely:
warm up, use a spotter for heavy attempts, and consult a qualified coach or clinician for
training or medical guidance.

## Privacy

All data lives in `chrome.storage.local` on your device. No network requests, no accounts,
no analytics.

## Install (developer mode)

1. Open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
2. Click **Load unpacked** and select this folder — or install the provided `.zip`.
3. Pin the extension and open the popup to start logging.

## Files

- `manifest.json` — Manifest V3, `storage` permission only
- `popup.html` / `popup.css` / `popup.js` — the logbook UI
- `icons/` — generated PNG icons (16/48/128)
