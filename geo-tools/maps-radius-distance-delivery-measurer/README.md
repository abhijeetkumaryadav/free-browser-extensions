# ZoneMap — Radius & Delivery Zone Measurer

Measure straight-line (great-circle) distances between two coordinates, and check whether a point falls inside a circular delivery zone — all computed locally on your device.

## What it does

- **Distance mode** — enter two latitude/longitude pairs and get the haversine great-circle distance, in km or miles, with a local canvas sketch of both points and a dashed connector.
- **Delivery-zone mode** — enter a zone center, a radius, and a test point. ZoneMap tells you **Inside zone** / **Outside zone** plus the point's distance from the center, and sketches the zone circle and both points.
- **Local sketch** — a simple equirectangular projection drawn on a canvas. No map tiles, no geocoding, no imagery.
- Inputs and unit preferences are remembered via `chrome.storage.local`.

The haversine math is smoke-tested (NYC → London ≈ 5,570 km) and input validation covers lat/lng ranges and radius bounds.

## Honest scope

- ZoneMap computes **straight-line distances only** — not road, walking, or driving distances.
- The sketch is a schematic projection, not a map; shapes distort away from the equator.
- It never touches the network: no tiles, no geocoding, no analytics. Everything is computed from the numbers you type.

## Permissions

- `storage` — remembers your last inputs, mode, and unit choices.

## Install (development)

**Chrome / Edge / Opera:**
1. Download and unzip `maps-radius-distance-delivery-measurer.zip`
2. Open `chrome://extensions` (or `edge://extensions`)
3. Enable **Developer mode**
4. Click **Load unpacked** and select the unzipped folder

**Firefox:** Load via `about:debugging` → This Firefox → Load Temporary Add-on.

## Publishing notes

- MV3, no deprecated APIs, no remote code, no network calls — minimal review surface.
- Single optional permission (`storage`) with clear justification.
