# Kp Index Watcher — Space Weather Edu

**Educational only — not live space-weather alerts.** This extension has no
data feed and cannot warn you about solar flares or geomagnetic storms.

## What it does

- **Kp scale guide** — plain-language reference for Kp 0–9 and the G1–G5
  geomagnetic storm scale (Quiet → Active → Minor → Moderate → Strong →
  Severe → Extreme).
- **Alert threshold note** — save the Kp level you personally watch for.
  This is a reminder note for yourself; the extension cannot push alerts.
- **Reading log** — log Kp values you check manually (e.g. at
  [swpc.noaa.gov](https://www.swpc.noaa.gov)) with a timestamp and note.
  Readings at or above your threshold are highlighted.
- **History** — newest-first list with per-entry delete and clear-all.

## Honest scope

- No network requests, no live data, no notifications.
- All readings and settings live in `chrome.storage.local` (capped at 100 readings).
- It explains the Kp scale; it does not forecast or monitor anything.

## Permissions

- `storage` — save your readings and threshold.

## Privacy

Everything stays in your browser. Nothing is uploaded or transmitted.
