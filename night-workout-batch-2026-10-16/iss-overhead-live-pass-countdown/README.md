# ISS Pass Countdown

Countdown to ISS overhead passes **you enter manually** — e.g. times you look up on heavens-above.com. Shows a live countdown to the next pass, optionally fires a notification 5 minutes before, and keeps a log of past passes.

## Honest scope (read this)

- **Your times — not live tracking.** This extension has no API access and cannot detect the ISS or your location.
- Get pass times from an external source (e.g. heavens-above.com), type them in, and it counts down.
- Nothing leaves your browser: all data lives in `chrome.storage.local`.

## Features

- Add pass date + time, optional max elevation and note
- Live 1-second countdown to the next upcoming pass
- Optional "notify 5 min before" alarm via `chrome.alarms` + `chrome.notifications`
- Upcoming/past list, newest ordering, delete entries

## Permissions

- `storage` — save your passes locally.
- `alarms` — schedule the pre-pass reminder.
- `notifications` — show the pre-pass reminder.

## Privacy

Fully local. No network, no analytics, no accounts.
