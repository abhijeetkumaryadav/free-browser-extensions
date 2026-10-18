# Review Velocity Analyzer v1.0.0

Track your Google Business review momentum without any scraping: manually log review counts and average ratings per business over time, then see review velocity (reviews/week), star-rating trends, and a growth chart — with an optional weekly reminder to log.

## Features

- Multiple businesses, each with a dated log of (total reviews, average stars)
- Review velocity computed between first and last datapoint (reviews/week)
- Star trend with ▲/▼/● indicators
- Canvas growth chart with review counts over time
- Per-datapoint delete, CSV export
- Optional weekly Monday 9:00 reminder notification

## Honest scope — no scraping

This extension **never reads Google Maps or Google Business pages**. Google's terms prohibit automated scraping, and browser extensions cannot reliably do it anyway. You copy the two numbers (total review count, average rating) from your Business Profile by hand — it takes ten seconds a week, and the analytics are computed locally from your entries.

## Install

**Chrome / Edge:** unzip → `chrome://extensions` (or `edge://extensions`) → enable Developer mode → Load unpacked → select the folder.

**Firefox:** `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → select `manifest.json`.

**Opera:** `opera://extensions` → Developer mode → Load unpacked.

## Permissions

- `storage` — your businesses and datapoints, on-device only.
- `alarms` + `notifications` — the optional weekly logging reminder only.
- `clipboardWrite` — CSV export.

No host permissions at all: the extension makes zero network requests.

## Publishing notes

- Manifest V3, no remote code, no external libraries, no network access.
- The alarms/notifications justification for store review: "optional weekly reminder to log review datapoints."
