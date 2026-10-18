# Territory Planner — Radius Lead Generator

Sales territory planner for field teams and lead-gen planning. Enter a center
address, set a radius, and save named territories with automatic area
estimates. Export everything as CSV for your CRM or spreadsheets.

**Honest scope:** this is a planning tool. It does not scrape businesses,
directories, or lead lists — all territories are entered by you.

## Features

- **Geocoded territories** — type any address; it's geocoded via the public
  OpenStreetMap Nominatim API only when you click "Geocode & add territory".
- **Radius in km or miles** — automatic area estimate (πr²) per territory.
- **Schematic overview** — canvas visualization showing territories sized and
  positioned relative to each other (not a map — no tiles, no tracking).
- **CSV export** — name, address, lat/lon, radius, and area per territory.
- **Fully local** — territories live in `chrome.storage.local` on your device.

## Install (development)

**Chrome / Edge:**
1. Unzip `geocoded-radius-lead-generator.zip`.
2. Go to `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

**Firefox:**
1. Go to `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on**.
2. Select `manifest.json` in the unzipped folder. (Temporary until signed.)

## Permissions

| Permission | Why |
|---|---|
| `storage` | Save your territories on-device. |
| Host: `https://nominatim.openstreetmap.org/*` | Geocode addresses you enter, only when you click the button. No background requests. |

## Publishing notes

- Manifest V3, no deprecated APIs.
- No remote code: all JS is bundled; the only network call is the
  user-triggered Nominatim geocode request.
- Nominatim's usage policy asks for reasonable request volume — this extension
  makes exactly one request per territory you add.
- For the Chrome Web Store listing you'll need the standard screenshots and a
  short privacy disclosure stating that addresses are sent to Nominatim for
  geocoding at the user's request.
