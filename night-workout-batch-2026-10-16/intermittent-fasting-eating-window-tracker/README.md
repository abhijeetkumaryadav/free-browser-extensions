# Intermittent Fasting Eating Window Tracker

Tracks your fasting/eating windows with start/stop timers, countdowns, and a history log.

**Tracker only — NOT medical advice.** Consult a professional before fasting. Stop if unwell.

## What it does

- Set your fasting window (e.g. 16h fast / 8h eat); plans persist locally
- Start fasting → countdown to window end; auto-transitions to the eating window with
  a notification, then back to idle when the eating window closes
- End early any time; history logs completed vs. ended-early sessions (last 100)
- Background alarms keep timing alive when the popup is closed

## Honest scope

- This is a personal timer and logbook — it does not give nutrition or medical advice,
  does not recommend fasting schedules, and does not track calories.
- 100% local: no network, no accounts, no telemetry.

## Files

- `manifest.json` — MV3, permissions: `storage`, `alarms`, `notifications`
- `popup.html` / `popup.css` / `popup.js` — 380px deep-dark glassmorphism UI
- `background.js` — alarm-driven timing engine with notification transitions
- `icons/` — PIL-generated 16/48/128 PNG icons
