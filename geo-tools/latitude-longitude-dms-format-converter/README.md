# CoordFlip — Lat/Lng DMS Converter

Convert coordinates between **decimal degrees** and **DMS** (degrees/minutes/seconds) in both directions.

## Features

- **Decimal → DMS**: enter latitude/longitude, get `28°36′50.04″N`-style output with N/S/E/W handling.
- **DMS → Decimal**: flexible parser accepts `28°36′50″N`, `28 36 50 N`, `28.6139N`, etc.
- **Batch**: paste one coordinate per line (`28.6139, 77.2090` or DMS), convert all at once, copy all results.
- Per-field and combined copy buttons, input validation (lat −90…90, lng −180…180), last inputs remembered locally.
- 100% local — no network, no tracking.

## Install

1. Download/unzip the release, or use the provided `.zip`.
2. Open `chrome://extensions` (Edge: `edge://extensions`).
3. Enable **Developer mode**.
4. **Load unpacked** → select the extension folder.

Firefox: `about:debugging` → This Firefox → Load Temporary Add-on → pick `manifest.json`.

## Permissions

- `storage` — remember last inputs locally. Nothing leaves the device.

## Publishing notes

- MV3, no remote code, no host permissions. Store-safe.
