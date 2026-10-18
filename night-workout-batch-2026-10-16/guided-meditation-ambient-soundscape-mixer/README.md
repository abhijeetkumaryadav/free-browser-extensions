# Ambient Soundscape Mixer

Mix generated ambient layers for focus, rest, or background calm — Chrome/Edge/Firefox/Opera (Manifest V3).

## What it does

- **4 synthesized layers**, each with its own on/off toggle and volume slider:
  - **Rain** — filtered white-noise patter
  - **Deep rumble** — low brown-noise drone
  - **Warm pad** — soft synthesized major chord
  - **Ocean** — brown noise with a slow filter swell mimicking waves
- **Master volume** slider.
- **Session timer** (off / 5–60 min) with a live countdown; fades out gently when time is up.
- One-tap **play/stop**. Layer settings persist locally.

## Honest scope

> **All sounds are generated live in your browser with the Web Audio API — not recordings.**

There is no AI, no streaming, no audio library. What you hear is math: oscillators and shaped noise.

## Privacy

- 100% local. No network requests, no analytics, no accounts.
- Nothing is recorded or transmitted. `chrome.storage.local` holds only your mixer preferences.

## Permissions

- `storage` — remember layer volumes, toggles, master volume, and timer choice.

## Files

- `manifest.json` — MV3 manifest
- `popup.html` / `popup.css` / `popup.js` — UI, styling, synthesis engine
- `icons/` — generated 16/48/128 PNG icons
- `README.md` — this file
