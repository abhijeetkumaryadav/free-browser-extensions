# Buddy Check-In — Accountability Streak Log

Daily accountability check-in reminder with a self-marked streak log and
copy-as-text sharing.

**Honest scope:** Reminder only — no account, no buddy sync, no network.
You check in each day, then copy the check-in text and send it to your
buddy yourself. Nothing is uploaded or synced anywhere.

## Features

- Daily reminder notification at a time you choose (on/off toggle)
- **Mark today done** button — one tap per day
- Streak counter: consecutive done-days ending today (or yesterday if
  today is still pending)
- 14-day history grid with today highlighted
- **Copy check-in text** — generates e.g.
  `✅ Checked in for 2026-10-17 — 5-day streak and counting.` and copies
  it so you can paste it to your buddy in any app
- Everything stored in `chrome.storage.local`

## Files

| File | Purpose |
|---|---|
| `manifest.json` | MV3 manifest (`storage`, `alarms`, `notifications`) |
| `background.js` | Daily alarm scheduling + reminder notification |
| `popup.html` / `popup.css` / `popup.js` | 380px deep-dark glassmorphism UI, streak engine |
| `icons/` | 16 / 48 / 128 px generated PNG icons |
| `README.md` | This file |

## Permissions

- `storage` — check-in days, reminder time, toggle
- `alarms` — fire the daily reminder
- `notifications` — show the reminder notification

Zero network. Fully local.
