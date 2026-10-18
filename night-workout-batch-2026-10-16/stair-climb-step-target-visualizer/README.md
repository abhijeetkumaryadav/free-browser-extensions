# Stair Climb Visualizer

**Honestly labeled: your logs — estimates only, not medical advice.** It counts the stairs *you* log and visualizes them. It measures nothing about your body and recommends nothing.

## What it does

- **Log flights** (or raw steps — converted at ~12 steps/flight) with one tap.
- **Daily target** with a live progress bar toward it.
- **Milestone badges** at 5 / 10 / 25 / 50 flights in a day.
- **Last 7 days** bar chart of logged flights.
- Everything in `chrome.storage.local` — fully offline, zero network.

## Files

| File | Purpose |
|---|---|
| `manifest.json` | MV3 manifest (permission: `storage` only) |
| `popup.html` / `popup.css` / `popup.js` | Log UI, progress, badges, 7-day chart |
| `README.md` | This file |
| `icons/` | 16/48/128 PNG icons |

## Permissions

- `storage` — your target and daily logs, stored locally.
