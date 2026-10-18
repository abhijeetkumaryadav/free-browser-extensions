# Great-Circle Flight Path Plotter

Enter two lat/long pairs and see the great-circle flight path drawn on a
canvas map, with N+1 spherical-linearly-interpolated waypoints, haversine
distance (km + nm) and initial bearing.

**Great-circle math — educational only. Not for navigation.**

## Features
- Haversine distance, initial bearing
- Canvas map sketch with graticule, path, and endpoints
- Antimeridian-safe stroke splitting
- Last inputs remembered in `chrome.storage.local`

## Files
- `manifest.json` — MV3 manifest (`storage` only)
- `popup.html` / `popup.css` / `popup.js` — UI and logic
- `icons/` — generated PNG icons

## Build
`node --check` on `popup.js`; manifest JSON validated; icons generated with PIL.
