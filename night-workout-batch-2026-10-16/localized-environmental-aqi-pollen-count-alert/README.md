# Air Diary — Personal AQI & Pollen Tracker

Manual air-quality diary. Log daily air observations and symptoms, see patterns
over time on a chart, and set personal threshold reminders based on your own logs.

## Honest scope

- **Your diary only.** This extension is a personal journal. It is **NOT** live AQI
  or pollen data — no air-quality API exists for browser extensions.
- Every number is typed in by you. Trends reflect your observations, not measurements.
- For real air-quality information, check your local air-quality authority.

## Features

- Daily log: air quality 1–5, pollen 1–5, symptoms checklist, freeform notes
- Trends tab: dual-line chart (air + pollen), averages, bad-air-day counts
- Symptom frequency stats
- Personal reminder: alert when bad-air days (quality ≥ 4) in the last 7 days
  reach your threshold — computed from your logs only
- Everything stored in `chrome.storage.local` — 100% local, zero network

## Permissions

- `storage` — save your diary entries and reminder settings on this device.

## Development build

Manifest parsing and JS syntax validated. Not yet tested in a live browser.
