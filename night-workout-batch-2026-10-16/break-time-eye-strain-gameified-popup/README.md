# Eye Break — Gamified Eye-Break Game

A playful break-time companion for your eyes. **This is a game, not medical
guidance.** It cannot diagnose, treat, or prevent any eye condition.

## What it does

- **Follow-the-Dot** — a 20-second mini-game: track a glowing dot around an
  arena with your eyes. Completing it earns **+10 points**.
- **Blink Counter** — tap "I blinked" each time you blink; 20 taps earn
  **+5 points** and reset.
- **Stats** — total points, current day streak, breaks taken today, best streak.
- **Break reminders** — optional notifications every 20/30/45/60 minutes that
  nudge you to play a round.

Everything runs locally in your browser. No network calls, no data leaves
your machine.

## Honest scope

- Points and streaks are just for fun — there is no medical measurement here.
- Reminders are simple time-based notifications (via `chrome.alarms`).
- Nothing is tracked about your eyes, blinks, or health.

## Files

| File | Purpose |
| --- | --- |
| `manifest.json` | Manifest V3 config |
| `popup.html` / `popup.css` / `popup.js` | Game UI and logic |
| `background.js` | Owns the reminder schedule (`chrome.alarms`) |
| `icons/` | Extension icons (16/48/128) |

## Permissions

- `storage` — scores, streaks, and preferences.
- `alarms` — break-reminder schedule.
- `notifications` — reminder nudges.

## Install

Load unpacked in `chrome://extensions` (Developer mode), or install the ZIP.
