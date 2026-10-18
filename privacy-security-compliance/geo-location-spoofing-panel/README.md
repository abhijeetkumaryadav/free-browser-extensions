# Geo Location Spoofing Panel v1.0.0

A privacy tool that overrides `navigator.geolocation` on web pages with
coordinates **you** choose — preset cities or custom lat/lng — with a master
switch and per-site enable. Your real location is never read; only the
coordinates you set are served to pages. All data stays on-device.

## Features
- Master on/off toggle
- 9 preset cities + custom latitude/longitude + accuracy slider
- Per-site toggle for the currently open site
- Spoofs `getCurrentPosition` and `watchPosition` via early page-world injection
- Clearly labeled as user-controlled spoofing everywhere in the UI

## Install
**Chrome / Edge:** unzip → `chrome://extensions` (or `edge://extensions`) → enable
Developer mode → Load unpacked → select this folder.
**Firefox:** `about:debugging#/runtime/this-firefox` → Load Temporary Add-on →
select `manifest.json`. (Firefox lacks MAIN-world content scripts; the injected
`<script>` fallback is used, which works on most pages.)
**Opera:** `opera://extensions` → Developer mode → Load unpacked.

## Permissions
- `storage` — save your chosen coordinates and per-site preferences locally.
- `activeTab` — read the current tab's hostname so the per-site toggle knows
  which site you're on. Granted only when you open the popup.
- Content scripts on `http(s)://*/*` at `document_start` — needed to inject the
  geolocation override before page scripts run. The script does nothing unless
  spoofing is enabled for that site.

## Publishing notes
- MV3, no remote code, no network calls, no analytics.
- Store listing should describe it as a privacy/location-testing tool and note
  that spoofing only affects pages while enabled.
