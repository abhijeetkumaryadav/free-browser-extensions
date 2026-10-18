# Rest Timer — Gym Chime Countdown

A simple gym rest timer. Set seconds (presets 60/90/120/180 or custom),
start the countdown, and hear a generated chime when time's up.

**Scope (honest):** Timer only — no coaching, no workout plans, no medical advice.

## Features

- Countdown ring with mm:ss readout
- Presets + custom seconds (1–3600)
- Web Audio chime generated in code — no audio files bundled
- Keeps running via `alarms` even when the popup is closed
- Chimes when the timer finishes while the popup is open

## Permissions

- `storage` — timer state + last duration
- `alarms` — keeps the countdown ticking while the popup is closed

## Local-only

No network calls, no analytics. Everything stays in the browser.
