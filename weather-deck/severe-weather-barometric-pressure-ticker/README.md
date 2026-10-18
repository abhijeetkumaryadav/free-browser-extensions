# PressWatch — Barometric Pressure Ticker (v1.0.0)

Live barometric pressure for any city, a 24-hour trend chart, and a simple
3-hour falling/rising heuristic.

## Features

- **City search** — type any city; results come from the Open-Meteo geocoding
  API. No automatic geolocation is ever requested.
- **Current pressure** — big hPa readout with the 3-hour change
  (e.g. "Falling · −2.3 hPa / 3h").
- **24-hour trend chart** — canvas sparkline with area fill, min/max labels
  and hour ticks.
- **Heuristic alert** — plain-language read of the trend:
  Falling fast / Falling / Steady / Rising.

> ⚠️ The alert is a **heuristic interpretation of a rough rule of thumb** —
> it is **not an official weather warning**. Always rely on your national
> meteorological service for severe-weather alerts.

## Install (Chrome / Edge / Opera)

1. Download and unzip `severe-weather-barometric-pressure-ticker.zip`.
2. Open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

Firefox: Manifest V3 with standard APIs (`storage`, `action`) and plain
`fetch()` calls; should work in Firefox but is only smoke-tested in Chromium.

## Permissions (why each is needed)

| Permission | Used for |
|---|---|
| `storage` | Remember your city. All local. |
| Host: `api.open-meteo.com`, `geocoding-api.open-meteo.com` | Fetch pressure data and city search. Free, no API key. No tracking. |

Data attribution: **Data: Open-Meteo** (https://open-meteo.com), shown in the
popup footer. All requests are made directly from your browser to Open-Meteo;
nothing passes through any other server.

## Publishing notes

- Manifest V3, no remote code, no analytics, no keys/secrets.
- Store listing must keep the "not an official warning" disclaimer.
