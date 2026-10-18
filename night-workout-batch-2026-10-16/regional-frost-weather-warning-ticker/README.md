# Frost Alert — Weather Ticker

Frost-risk warnings for your garden, farm, or commute — powered by free Open-Meteo forecast data (no API key required).

## What it does

- **Location search** — find your city/place via the Open-Meteo geocoding API (also free, no key).
- **7-night frost ticker** — overnight minimum temperatures classified into severity levels:
  - **Severe frost** (< −2 °C)
  - **Frost likely** (−2…0 °C)
  - **Frost watch** (0…2 °C)
  - **No frost** (> 2 °C)
- **Toolbar badge** — `!` appears when frost is expected within the next 2 nights (pink = severe, orange = likely).
- **Background refresh** — forecast re-fetches every 6 hours via alarms so the badge stays current.
- **Offline fallback** — the last cached forecast is shown with a "cached" label when the network is unavailable.

## Honest scope

Frost guidance is heuristic (based on 2 m air-temperature minima) and microclimates vary. Protect sensitive plants when in doubt.

## Permissions

- `storage` — saves your location and cached forecast locally.
- `alarms` — periodic background refresh.
- Host permissions for `api.open-meteo.com` and `geocoding-api.open-meteo.com` — forecast and place search only.

## Install (developer mode)

1. Open `chrome://extensions`, enable **Developer mode**.
2. Click **Load unpacked** and select this folder.
3. Click the toolbar icon, search your location, and set it.
