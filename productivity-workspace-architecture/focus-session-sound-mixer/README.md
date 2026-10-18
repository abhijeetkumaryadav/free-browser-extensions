# Focus Session Sound Mixer v1.0.0

A Pomodoro focus timer with a built-in ambient sound mixer:

- **Timer** — 25/5, 50/10, 15/3 presets or custom lengths, pause/resume,
  skip, auto long-break every 4 sessions, phase-end notifications, and
  session stats (sessions today, total focus minutes). The countdown is
  driven by timestamps, so it stays accurate even with the popup closed.
- **Sound mixer** — rain, white, pink and brown noise generated **live
  with WebAudio** (no audio files, no network). Individual power toggles
  and volume sliders plus a master volume. Sounds keep playing after the
  popup closes via an offscreen audio document.

## Install

**Chrome / Edge**
1. Unzip `focus-session-sound-mixer.zip`.
2. Open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
3. **Load unpacked** → select the unzipped folder.

**Firefox** (temporary, for testing)
1. Unzip, open `about:debugging#/runtime/this-firefox`.
2. **Load Temporary Add-on** → pick `manifest.json` inside the folder.
   Note: Firefox's offscreen-document audio support may differ; the timer
   works everywhere, mixer is best on Chromium.

## Permissions
- `storage` — timer settings, mixer levels, session stats. On-device only.
- `alarms` — wakes the timer at phase boundaries (minute granularity;
  the exact end is verified from the stored timestamp).
- `offscreen` — keeps the WebAudio mixer alive after the popup closes.
- `notifications` — "Focus complete" / "Break over" alerts.

## Publishing notes
- Chrome Web Store: $5 one-time developer fee.
- No remote code, no network calls, no data leaves the device.
