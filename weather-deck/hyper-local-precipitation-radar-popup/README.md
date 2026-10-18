# RainScope — Precipitation Radar Popup (v1.0.0)

A polished popup showing **hyper-local precipitation for any city**: current
temperature + weather description, current rain probability and rainfall, and a
**next-12-hours rain-probability bar chart** drawn on canvas.

**Data source:** Open-Meteo forecast + geocoding APIs — genuinely free, **no API
key required**, CORS-enabled. Attribution shown in the popup and here.

## Install (development)

**Chrome / Edge:**
1. Download/unzip this folder.
2. Open `chrome://extensions`, enable **Developer mode**.
3. Click **Load unpacked** and select this folder.

**Firefox:**
1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on** and select `manifest.json`.

## Permissions (justified)

| Permission | Why |
|---|---|
| `storage` | Remember the last searched city so it loads on open. |
| `https://api.open-meteo.com/*` | Fetch current + hourly precipitation forecast. No key, no tracking. |
| `https://geocoding-api.open-meteo.com/*` | City name → coordinates lookup. |

No geolocation is requested — you type the city yourself. No data leaves the
browser except the two Open-Meteo API calls above. No remote code is loaded.

## Privacy

- No accounts, no analytics, no cookies.
- Only the city coordinates you search are sent to Open-Meteo to fetch data.

## Publishing notes

- MV3, no deprecated APIs.
- If publishing to the Chrome Web Store, disclose the Open-Meteo data source in
  the listing description (privacy tab): "Fetches weather data from
  api.open-meteo.com and geocoding from geocoding-api.open-meteo.com; no personal
  data is collected."

## Honest scope

- Values are forecast-model outputs from Open-Meteo, **not live radar imagery**
  (the popup and scope note say this explicitly).
- Probabilities are model estimates and can be wrong — check official sources
  for severe-weather decisions.
