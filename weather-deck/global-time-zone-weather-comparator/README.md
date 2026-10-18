# GlobalTime — World Time & Weather Comparator

Compare up to **4 cities** side by side: each card shows the city's **local time**, **date**, **current temperature**, **condition**, and **humidity**.

- Search cities with the built-in geocoding search (Open-Meteo).
- Cities persist in `chrome.storage.local` — reopen the popup anytime.
- One-click refresh; clocks tick locally every 30 s without network calls.
- Timezone is taken from the Open-Meteo `timezone` field — accurate including DST.

## Data source

**Weather data: [Open-Meteo](https://open-meteo.com)** — genuinely free, no API key, no account, CORS-enabled. Geocoding: `geocoding-api.open-meteo.com`, forecast: `api.open-meteo.com`.

No geolocation is requested. No analytics. The extension never sends anything except the two Open-Meteo API calls needed for search and forecast.

## Install

**Chrome / Edge / Opera**
1. Download/unzip this folder.
2. Go to `chrome://extensions` → enable **Developer mode**.
3. **Load unpacked** → select this folder.

**Firefox**
- Firefox doesn't support Manifest V3 host-permission fetches from popups in exactly the same way, and the `geocoding-api.open-meteo.com` host permission model differs. This build targets Chromium browsers. A Firefox port would need `browser.*` namespace adjustments.

## Permissions

| Permission | Why |
|---|---|
| `storage` | Persist your saved city list between popup opens. |
| host: `api.open-meteo.com` | Fetch current weather (forecast API). |
| host: `geocoding-api.open-meteo.com` | City search suggestions. |

## Publishing notes

- Remote data is limited to the Open-Meteo endpoints declared in host permissions; no remote code is ever executed.
- Attribute Open-Meteo in the store listing description (already attributed in-app).
- Works offline except for weather/search calls, which fail gracefully with a retry hint.
