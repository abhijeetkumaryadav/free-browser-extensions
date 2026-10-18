# Audio Speed & Pitch Controller v1.0.0

Set playback speed (0.25x–4x) on any page with audio or video —
lectures, podcasts, streams. Slider + presets (0.5x, 1x, 1.25x,
1.5x, 2x), a preserve-pitch toggle so voices stay natural at high
speed, live stats of media elements found, and per-site memory that
auto-applies your saved speed. Fully reversible — reload the page
and everything returns to normal.

## Try it
1. Unzip `audio-speed-pitch-controller.zip`.
2. Chrome/Edge: `chrome://extensions` (or `edge://extensions`) → Developer mode → **Load unpacked** → select the folder.
3. Firefox: `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → pick `manifest.json`.
4. Open any video/audio page, click the icon, drag the slider.

## Permissions
- `activeTab` + `scripting` — read and adjust media elements only on
  the tab you open the popup on. Nothing runs in the background.
- `storage` — remembers your per-site speed on-device. Nothing uploaded.

## Publishing notes
- Chrome Web Store: $5 one-time developer registration. Declare the
  media-control purpose in the privacy section.
- Firefox Add-ons: free account; the extension must pass Mozilla signing.
