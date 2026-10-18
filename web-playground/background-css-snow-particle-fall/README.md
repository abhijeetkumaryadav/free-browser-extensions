# SnowFall — Snow Particle Overlay

Let it snow on any web page. A fun, reversible snow-particle overlay with
density, flake size, fall speed, and wind controls.

## Install (development build)

1. Unzip `background-css-snow-particle-fall.zip` (or use the source folder).
2. Open `chrome://extensions` (Edge: `edge://extensions`).
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the extracted folder.

## How to use

1. Open any web page.
2. Click the SnowFall toolbar icon.
3. Flip the toggle on — snow starts falling over the page.
4. Drag the sliders for density, flake size, speed, and wind. Changes apply live.
5. Toggle off to stop. Closing the tab also stops it.

The popup never auto-enables snow: the overlay only starts when *you* toggle it.

## Permissions

- `storage` — remembers your slider settings on this device.
- `activeTab` + `scripting` — injects the snow overlay into the current tab
  only when you toggle it on. Nothing runs on pages you don't choose.

## Technical notes

- The overlay lives in a closed shadow-DOM host (`#__snowfall_overlay_host__`)
  with `pointer-events: none`, so the page's own styles, clicks, and scripts
  are never affected.
- Canvas is device-pixel-ratio aware (capped at 2x) and particle counts are
  capped (max 300), keeping it smooth on modest hardware.
- Can't snow on browser-protected pages (`chrome://`, Web Store, etc.) — the
  popup explains this with a notice.
- No network calls. No tracking. No data leaves the device.

## Publishing notes

- MV3 only, no remote code, no deprecated APIs.
- Host permissions are not requested; `activeTab` + user gesture only.
