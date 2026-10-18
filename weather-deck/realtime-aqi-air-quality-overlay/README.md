# AirLens — Real-Time Air Quality (v1.0.0)

A polished popup that shows **live air quality for any city**: US AQI and European
AQI with color-coded health bands, health advice, and current PM2.5 / PM10 / O₃ /
NO₂ concentrations (µg/m³).

**Data source:** Open-Meteo air quality + geocoding APIs — genuinely free, **no API
key required**, CORS-enabled. Attribution shown in the popup and here.

## Install (development)

**Chrome / Edge:**
1. Download/unzip this folder.
2. Open `chrome://extensions`, enable **Developer mode**.
3. Click **Load unpacked** and select this folder.

**Firefox:**
1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on** and select `manifest.json`.
3. Note: the `host_permissions` entries work in Firefox as `host` origins; temporary add-ons are fine.

## Permissions (justified)

| Permission | Why |
|---|---|
| `storage` | Remember the last searched city so it loads on open. |
| `https://api.open-meteo.com/*` | Fetch current air-quality data. No key, no tracking. |
| `https://geocoding-api.open-meteo.com/*` | City name → coordinates lookup. |

No geolocation is requested — you type the city yourself. No data leaves the
browser except the two Open-Meteo API calls above. No remote code is loaded.

## Privacy

- No accounts, no analytics, no cookies.
- Only the city coordinates you search are sent to Open-Meteo to fetch data.

## Publishing notes

- MV3, no deprecated APIs.
- If publishing to the Chrome Web Store, disclose the Open-Meteo data source in
  the listing description (privacy tab): "Fetches air-quality data from
  api.open-meteo.com and geocoding from geocoding-api.open-meteo.com; no personal
  data is collected."

## Honest scope

- Values are model/observation blends from Open-Meteo, not a personal air sensor.
- Health bands follow US EPA and European EEA index conventions; they are
  general guidance, not medical advice.
