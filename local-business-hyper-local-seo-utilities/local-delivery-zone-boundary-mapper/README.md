# Delivery Zone Mapper

Delivery-zone planner for restaurants, couriers, and local shops. Define
zones by center address + radius, set a delivery fee and minimum order per
zone, then check whether any customer address falls inside your zones.

**Honest scope:** a planning tool with data you enter yourself. It does not
scrape businesses or customer lists.

## Features

- **Delivery zones** — name, center address (geocoded on demand via
  OpenStreetMap Nominatim), radius in km or miles, delivery fee, minimum order.
- **Coverage checker** — type a customer address; it's geocoded on demand and
  matched against your zones with haversine distance, showing which zones
  cover it (or the nearest zone when none do).
- **Schematic overview** — canvas visualization of zones sized and positioned
  relative to each other (not a map — no tiles, no tracking).
- **CSV export** — full zone list with coordinates, radius, fee, and minimum.
- **Fully local** — zones live in `chrome.storage.local` on your device.

## Install (development)

**Chrome / Edge:**
1. Unzip `local-delivery-zone-boundary-mapper.zip`.
2. Go to `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

**Firefox:**
1. Go to `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on**.
2. Select `manifest.json` in the unzipped folder. (Temporary until signed.)

## Permissions

| Permission | Why |
|---|---|
| `storage` | Save your zones on-device. |
| Host: `https://nominatim.openstreetmap.org/*` | Geocode addresses you enter, only when you click a button. No background requests. |

## Publishing notes

- Manifest V3, no deprecated APIs.
- No remote code: all JS is bundled; the only network calls are the
  user-triggered Nominatim geocode requests.
- For the Chrome Web Store listing you'll need the standard screenshots and a
  short privacy disclosure stating that addresses are sent to Nominatim for
  geocoding at the user's request.
