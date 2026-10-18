# Break Enforcer — RSI Break Timer

A pomodoro-style work/break cycle timer that nudges you to move during breaks.

## What it does

- **Work blocks** (default 25 min) with a live progress ring and countdown in the popup.
- **Break overlay**: when a work block ends, a full-screen overlay appears on the
  active tab with a countdown ring, a randomly-picked generic stretch/movement
  suggestion, and skip / done-early buttons (or press ESC).
- **Enforce mode** (optional): dims the current page heavily during breaks so
  you're less tempted to keep working — still skippable at any time.
- **Cycle tracking**: counts completed breaks in the popup.
- The overlay also appears if you switch tabs mid-break.

## Permissions

- `storage` — your settings and cycle state (local only)
- `alarms` — run the work/break cycle with the popup closed
- `scripting` + host permissions — inject the break overlay into the active tab
  when a break starts (never on internal `chrome://` pages)

Everything is 100% local. No network, no accounts, no analytics.

## Scope note

**Reminders only — not medical advice.** This extension runs timers and shows
generic movement suggestions; it does not diagnose, treat, or prevent any
condition. If you have pain or concerns, talk to a health professional.
