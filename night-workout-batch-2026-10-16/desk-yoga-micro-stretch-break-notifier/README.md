# Desk Yoga — Micro-Stretch Break Notifier

Gentle break reminders for desk workers. Every N minutes (configurable, 5–240)
a notification appears with a random desk-friendly stretch suggestion and a
"Snooze 10 min" button.

**Scope (honest):** reminders only — **not medical advice**. The bundled moves
are gentle desk stretches; skip anything that hurts. The extension never
diagnoses, recommends treatment, or assesses fitness.

## Features

- Repeating break alarm via `chrome.alarms` (works when the popup is closed)
- Notification with a random stretch from a bundled list of 12
- Snooze 10 minutes from the notification button
- Popup: enable/disable, interval picker, "Preview a stretch now"
- Fully local: `chrome.storage.local` only, zero network, no analytics

## Permissions

- `alarms` — repeating break cadence
- `notifications` — break alerts with snooze action
- `storage` — interval + enabled settings

## Files

- `manifest.json` — Manifest V3
- `background.js` — alarm scheduling, notification + snooze handling
- `popup.html` / `popup.css` / `popup.js` — settings + preview UI
- `icons/` — generated PNG icons

## Load it

1. Open `chrome://extensions`, enable Developer mode
2. "Load unpacked" → select this folder
3. Open the popup to set your interval
