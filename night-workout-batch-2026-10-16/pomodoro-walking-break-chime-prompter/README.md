# Pomodoro Walking Break Prompter

A Pomodoro focus timer whose breaks suggest a short walk, with generated Web Audio chimes.

**Timer only — not medical advice.** Walk safely; skip anything that hurts.

## What it does

- Configurable focus / short break / long break durations (long break every N sessions)
- Web Audio chimes on phase changes while the popup is open (generated tones — no audio files)
- Background alarms keep timing alive when the popup is closed; phase changes then fire
  notifications instead (service workers cannot play audio — this is labeled in the popup)
- Pause / resume / reset; session counter; settings persist locally

## Honest scope

- This is a timer with break reminders — it is not medical or fitness advice.
- Break text suggests a short walk; it does not track steps or verify you walked.
- 100% local: no network, no accounts, no telemetry.

## Files

- `manifest.json` — MV3, permissions: `storage`, `alarms`, `notifications`
- `popup.html` / `popup.css` / `popup.js` — 380px deep-dark glassmorphism UI, chime player
- `background.js` — alarm-driven timing engine, notification fallback
- `icons/` — PIL-generated 16/48/128 PNG icons
