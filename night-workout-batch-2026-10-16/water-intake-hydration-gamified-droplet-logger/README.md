# Droplet — Water Intake Logger

A gamified, fully local water intake logger. No network.

## What it does

- Animated droplet that fills as you log glasses toward your daily goal
- Configurable glass size (200/250/350/500 ml) and daily goal (250–10,000 ml)
- Log / undo glasses, clear today's log
- Streak counter: consecutive days hitting your goal
- 14-day history with per-day bars and goal-hit highlighting
- All data in `chrome.storage.local`

## Honest scope

- **You log your own intake — not medical advice.** The extension cannot measure how much you drink; it tracks what you tell it.
- Streaks and averages are computed from self-reported data only.

## Files

- `manifest.json` — Manifest V3
- `popup.html` / `popup.css` / `popup.js` — UI + engine
- `icons/` — generated PNG icons

## Permissions

- `storage` — goal, glass size, and daily logs
