# BBoxGrab — Bounding Box GeoJSON Generator v1.0.0

Draw a box on a coordinate grid or type coordinates manually, and get a valid GeoJSON `Polygon` Feature with copy + `.geojson` download. **Manual input only** — no geocoding, no map tiles, no network requests.

## Install

**Chrome / Edge / Opera**
1. Unzip `bounding-box-geojson-geometry-grabber.zip`.
2. Open `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select the folder.

**Firefox**
1. Unzip the package.
2. Open `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → select `manifest.json`.

## Features
- **Draw tab**: drag on an equirectangular graticule grid (−180…180, −90…90) to define the box; corner handles shown
- **Type coords tab**: enter West / South / East / North manually (validated + clamped, auto-ordered)
- Live GeoJSON output: `Feature` with `Polygon` geometry (closed ring, 6-decimal precision) + `bbox` property
- Approximate area shown (≈ km², spherical-earth math)
- Copy to clipboard (with fallback) and download `.geojson`

## Permissions
- `storage` — minimal; reserved for preference persistence. No data leaves the device.

## Honest scope
- The canvas is a coordinate frame, not a real map — there are no tiles, no search, no geocoding.
- Coordinates are user-supplied; accuracy is the user's responsibility.

## Publishing notes
- MV3, no host permissions, no remote code. Store-safe.
