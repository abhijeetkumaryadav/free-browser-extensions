# Recovery Check-In — Manual Recovery Score

Rate your sleep quality, energy, soreness (freshness) and mood each morning
(1–5 sliders); the extension computes a 0–100 recovery score with a plain
verdict, a 7-day trend chart, and a history log.

## Honest scope

- **Your ratings — NOT an HRV measurement.** This extension has no heart-rate
  or HRV hardware access and makes no such claim.
- **Not medical advice.** The score is a simple average of your own 1–5
  ratings, mapped to 0–100. It cannot diagnose fatigue, illness, or
  readiness. Talk to a professional for health concerns.
- 100% local: everything lives in `chrome.storage.local`. No network, no
  accounts, no analytics.

## How the score works

`score = round(((avg(sleep, energy, soreness, mood) − 1) / 4) × 100)`

Soreness is asked as freshness (5 = fresh) so higher is always better.
One entry per day — re-checking in overwrites today's entry.

## Files

- `manifest.json` — MV3 manifest (permission: `storage` only)
- `popup.html` / `popup.css` / `popup.js` — UI; the pure engine
  (`computeScore`, `scoreLabel`, `clampRating`, `todayKey`, `fmtDate`) sits
  between `// ENGINE-START` and `// ENGINE-END` for testability
- `README.md`, `icons/icon{16,48,128}.png`

## Privacy

All check-ins stay on your device. Nothing is transmitted.
