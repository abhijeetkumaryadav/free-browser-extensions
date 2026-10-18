# UVGuard — UV Index & Sunscreen Timer (v1.0.0)

Live UV index for any city, exposure guidance bands, and a reapply-sunscreen
timer that keeps running even when the popup is closed.

## Features

- **City search** — type any city; results come from the Open-Meteo geocoding
  API. No automatic geolocation is ever requested.
- **Current UV index** — big readout with a WHO-style guidance band
  (Low / Moderate / High / Very high / Extreme) and plain-language advice.
- **Next-12-hours chart** — hourly UV bars colored by band so you can plan
  outdoor time.
- **Reapply timer** — set 5–480 minutes. Uses `chrome.alarms`, so the timer
  survives the popup being closed. Fires a desktop notification and shows the
  remaining minutes on the toolbar badge.

> Health note: guidance bands are general information only — **not medical
> advice**. Follow your dermatologist's recommendations.

## Install (Chrome / Edge / Opera)

1. Download and unzip `uv-index-sunscreen-timer-alert.zip`.
2. Open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

Firefox: the extension uses Manifest V3 and standard WebExtension APIs
(`alarms`, `notifications`, `action`, `storage`); geocoding/forecast calls are
plain `fetch()` and work in Firefox, but the package is only smoke-tested in
Chromium.

## Permissions (why each is needed)

| Permission | Used for |
|---|---|
| `storage` | Remember your city, timer length and timer state. All local. |
| `alarms` | Run the reapply timer in the background after the popup closes. |
| `notifications` | Show the "time to reapply" alert when the timer finishes. |
| Host: `api.open-meteo.com`, `geocoding-api.open-meteo.com` | Fetch UV forecast and city search. Free, no API key. No tracking. |

Data attribution: **Data: Open-Meteo** (https://open-meteo.com), shown in the
popup footer. All requests are made directly from your browser to Open-Meteo;
nothing passes through any other server.

## Publishing notes

- Manifest V3, no remote code, no analytics, no keys/secrets.
- Store listing should keep the "not medical advice" disclaimer.
