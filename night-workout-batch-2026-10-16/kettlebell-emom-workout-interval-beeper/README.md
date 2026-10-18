# EMOM Interval Beeper

Configurable EMOM (every-minute-on-the-minute) style interval beeper for kettlebell
and conditioning workouts. **Timer only — no coaching, no medical advice.**

## What it does

- Configure **work seconds**, **rest seconds**, and **rounds**
- 10-second prep countdown, then alternating work/rest with 3-2-1 countdown beeps
- **Web Audio beeps** (generated tones, no audio files): high double-beep = work,
  low beep = rest, fanfare = workout complete
- Timing runs in the background on **1-second alarms**, so it survives popup close
- When the popup is closed, **phase-change notifications** fire instead of beeps
  (beeps need the popup open — browsers can't play audio from a service worker)

## Honest scope

- A timer. It does not plan workouts, coach form, or give health advice.
- All state is local (`chrome.storage.local`); zero network.

## Install (developer mode)

1. Open `chrome://extensions`, enable **Developer mode**
2. **Load unpacked** → select this folder
3. Pin the extension and click the icon to configure and start

## Files

| File | Purpose |
|---|---|
| `manifest.json` | MV3 manifest |
| `background.js` | Alarm-driven timing engine (`step` state machine between `// ENGINE-START`/`// ENGINE-END`) |
| `popup.html` / `popup.css` / `popup.js` | Config UI, clock rendering, Web Audio beeps |
| `icons/` | 16/48/128 PNG icons |

v1.0.0 · MIT
