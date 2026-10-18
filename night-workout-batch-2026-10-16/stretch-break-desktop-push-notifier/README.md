# Stretch Break — Custom Push Notifier

A Manifest V3 micro-break notifier that uses **your own** reminder messages —
distinct from preset stretch lists.

## What it does

- Write your own reminder messages (one per line); a random one fires each interval
- Configurable interval (10–180 min) via `chrome.alarms`
- Notification has a **Done** button that appends to a local done log (last 100)
- "Send test now" previews a notification; log can be cleared

## Honest scope

Your messages — **reminders only**. Not medical advice, tracks nothing else.

## Permissions

- `storage` — messages, interval, done log
- `alarms` — repeating reminders (survives popup close)
- `notifications` — the push reminders themselves

## Files

- `manifest.json`, `popup.html`, `popup.css`, `popup.js`
- `background.js` — alarm + notification engine
- `icons/icon{16,48,128}.png`
