# Rain Overlay — Ambient Raindrop Physics

A calming full-page canvas overlay of ambient raindrops with simple physics:
drops accelerate under gravity, drift with an adjustable wind, and burst into
ripple rings and splash streaks when they hit the bottom of the viewport.

Pure visual ambience: pointer-events pass straight through, pages stay fully
clickable. 100% local, no tracking, no network. Stops cleanly.

## Install (developer mode)

1. Open `chrome://extensions` (or `edge://extensions`).
2. Enable **Developer mode**.
3. Click **Load unpacked** and select this folder.
4. Click the toolbar icon → **Start Rain**.

## Features

- Raindrop streaks with gravity + per-drop jitter
- Wind slider (-10…10), slanted streaks follow the wind
- Expanding ripple rings on impact (toggleable)
- Splash micro-streaks on impact (toggleable)
- Intensity slider 1–10
- Settings persist in `chrome.storage.local` and apply live
- Pauses when the tab is hidden (saves CPU); particle caps for performance

## Honest scope

This is a decorative ambience toy, not a weather simulation. The "ground" is
simply the bottom of the viewport — drops don't interact with page elements.
No canvas fingerprinting, no data collection.

## Permissions

| Permission | Why |
|---|---|
| `storage` | Save intensity/wind/toggle preferences |
| `activeTab` + `scripting` | Inject the overlay only when you start it |

## Publishing notes

- Manifest V3, zero remote code, zero network calls.
- No user data collected — safe for Chrome Web Store listing.
