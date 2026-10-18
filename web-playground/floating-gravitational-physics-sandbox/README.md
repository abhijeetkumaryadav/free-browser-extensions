# OrbitBox — Gravity Physics Sandbox

A fun physics toy in a full-page tab. Click to drop balls, drag to fling them — they fall, bounce, and collide under tunable gravity. Hand-rolled 2D physics (no libraries), motion trails, pause/clear. Pure toy, clearly labeled as such.

## Install (Chrome / Edge)

1. Unzip `floating-gravitational-physics-sandbox.zip`.
2. Open `chrome://extensions` (or `edge://extensions`).
3. Enable **Developer mode**.
4. **Load unpacked** → select the unzipped folder.

**Firefox:** `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → pick `manifest.json`. `chrome.storage` / `chrome.tabs` work via the `chrome` namespace in Firefox MV3.

## Permissions

- `storage` — remembers your default ball size, gravity, and trail toggle. No network calls, nothing leaves your device.

## Features

- Click to drop a ball, drag to fling it (release velocity is sampled from your drag).
- Gravity slider (0–3000 px/s²), bounciness slider, motion-trail toggle.
- Ball–ball elastic collisions + wall/floor bounce (semi-implicit Euler, fixed 120 Hz timestep).
- Pause, clear, live ball count (capped at 300 for performance).

## Publishing notes

- MV3, no remote code, no external assets — store-safe.
- No broad host permissions; sandbox page is an extension page, not a content script.
