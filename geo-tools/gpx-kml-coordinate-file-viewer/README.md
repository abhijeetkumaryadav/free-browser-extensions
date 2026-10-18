# TrackView — GPX/KML Coordinate File Viewer v1.0.0

Drop a `.gpx` or `.kml` file to preview the track on a local canvas, see distance/elevation stats, and export GeoJSON. **100% local** — files are parsed in your browser with `DOMParser`; no map tiles, no network requests.

## Install

**Chrome / Edge / Opera**
1. Unzip `gpx-kml-coordinate-file-viewer.zip`.
2. Open `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select the folder.

**Firefox**
1. Unzip the package.
2. Open `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → select `manifest.json`.

## Features
- Drag-and-drop or click-to-choose `.gpx` / `.kml` (also accepts generic `.xml`)
- Equirectangular track rendering on canvas (no map tiles needed), with start (green) / end (red) markers
- Stats: point count, total distance (haversine), elevation gain, elevation range
- Elevation profile chart (when the file includes elevation)
- One-click GeoJSON export (LineString FeatureCollection)
- GPX tracks + waypoints fallback; KML Placemark coordinates (`lon,lat[,ele]`)

## Permissions
- `storage` — minimal; reserved for future preference persistence. No data leaves the device.

## Honest scope
- Coordinates only: does not geocode, reverse-geocode, fetch map tiles, or upload anything.
- Files that fail XML parsing or contain no coordinates are rejected with a clear message.

## Publishing notes
- MV3, no host permissions, no remote code. Store-safe.
