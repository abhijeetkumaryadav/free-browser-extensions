# Blink & Sip — Gamified Hydration Reminder

A friendly, gamified reminder to blink and drink water while you work.

## What it does

- **Gentle notifications** remind you to blink (default every 20 min) and drink
  water (default every 60 min). Intervals are adjustable from the popup.
- **Gamification**: tap "I blinked" (+5 pts) or "I drank water" (+10 pts) to
  grow your daily streak; lifetime points, best streak and today's completions
  persist in `chrome.storage.local`.
- **Keeps working when the popup is closed** — a background service worker owns
  the `chrome.alarms` schedule, so reminders survive popup close and browser
  restart.

## Permissions

- `storage` — your settings, points and streaks (local only)
- `alarms` — schedule the reminder cadence
- `notifications` — show the gentle reminders

Everything is 100% local. No network, no accounts, no analytics.

## Scope note

**Reminders only — not medical guidance.** This extension nudges you to blink
and hydrate; it does not diagnose, treat, or give health advice. Talk to a
health professional if you have concerns about your eyes or hydration.
