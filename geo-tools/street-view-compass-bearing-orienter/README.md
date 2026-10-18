# BearingPoint — Compass Bearing Calculator

Compute the **initial great-circle bearing**, 16-wind compass direction, and haversine distance between two latitude/longitude points — with an animated compass dial rendered on a local canvas.

## Honest scope

This is a **bearing calculator only**. It does not access Street View, Google Maps, or any map tiles. All math runs locally on your device.

## Features

- From/To lat/lng inputs with validation, swap button.
- Initial bearing (0–360°), compass direction (N, NNE, …), distance (m/km).
- Animated compass dial with shortest-path needle easing.
- Last inputs remembered locally.

## Install

1. Download/unzip the release, or use the provided `.zip`.
2. Open `chrome://extensions` (Edge: `edge://extensions`).
3. Enable **Developer mode**.
4. **Load unpacked** → select the extension folder.

Firefox: `about:debugging` → This Firefox → Load Temporary Add-on → pick `manifest.json`.

## Permissions

- `storage` — remember last inputs locally. Nothing leaves the device.

## Publishing notes

- MV3, no remote code, no host permissions, no network. Store-safe.
