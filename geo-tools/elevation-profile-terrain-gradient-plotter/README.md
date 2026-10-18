# PeakPlot — Elevation Profile Chart v1.0.0

Enter a start and end coordinate (or waypoints) and plot an elevation profile with a
gradient-filled chart, total distance, min/max elevation, and ascent/descent.

## Install
1. Unzip the release.
2. Open `chrome://extensions` (Edge: `edge://extensions`), enable **Developer mode**.
3. **Load unpacked** → select this folder.
4. Firefox: `about:debugging#/runtime/this-firefox` → Load Temporary Add-on.

## Permissions
- `storage` — remembers your last start/end inputs and sample count.
- Host permission `https://api.open-meteo.com/*` — fetches elevation samples from the
  free, keyless Open-Meteo elevation API. No API key, no account. Data is attributed
  as "Data: Open-Meteo" in the popup.

## Scope notes
- Straight-line sampling between start and end (not road routing).
- Open-Meteo elevation data is approximate; verify critical measurements elsewhere.

## Publishing notes
- Manifest V3, no deprecated APIs, no remote code.
- Single external dependency: the Open-Meteo elevation API (keyless, CORS-enabled).
