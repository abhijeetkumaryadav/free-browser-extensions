# StormWatch — Custom Weather Alert Notifier

Set **your own** weather thresholds for a city and get desktop notifications when current
conditions cross them. User-defined alerts only — this is **not** an official weather
warning service.

## Install

- **Chrome / Edge / Opera:** unzip the folder, open `chrome://extensions`, enable
  **Developer mode**, click **Load unpacked**, select the folder.
- **Firefox:** MV3 `chrome.alarms` + `chrome.notifications` are supported, but the
  Open-Meteo host permissions and notification behavior may differ; tested for
  Chromium first.

## How to use

1. Type a city and click **Search**, then pick the right result (Open-Meteo geocoding —
   no GPS, no auto-geolocation).
2. Tick the thresholds you want (temp below/above, wind above, rain chance above)
   and set values.
3. Flip the toggle on and click **Save settings**. A background check runs every
   30 minutes; **Check now** runs one immediately.
4. Crossed thresholds fire a desktop notification naming the threshold value.

## Permissions

- `storage` — saves your city, thresholds, and last check.
- `alarms` — runs the 30-minute background check.
- `notifications` — shows the desktop alert.
- `https://api.open-meteo.com/*` + `https://geocoding-api.open-meteo.com/*` —
  fetches weather data (free, no API key). No other network.

## Data & scope

- Data: **Open-Meteo** (free, keyless). Attributed in the popup.
- Alerts reflect *your* thresholds against current conditions — they are not
  official severe-weather warnings. For official warnings, use your national
  meteorological service.
- API failures surface a clear error state; nothing is retried silently.

## Publishing notes

- Notifications permission requires user consent at install; the toggle is off
  by default until the user configures it.
- No remote code, no analytics, no credentials.
