# Micro Walk Converter

Walk & commute distance converter. 100% local — no network, no analytics.

## What it does

- **Distance**: convert between kilometres and miles.
- **Steps ⇄ distance**: estimate kilometres from your step count (or steps from a
  distance) using your stride length setting.
- **Walking time**: estimate how long a distance takes at your walking pace.

> **Estimates** — stride length and walking pace vary by person; treat results as
> rough guides.

## Settings

- **Stride length** (default 75 cm) and **walking pace** (default 5 km/h) persist
  in `chrome.storage.local` and apply to all conversions.

## Files

| File | Purpose |
|---|---|
| `manifest.json` | MV3 manifest (`storage` permission only) |
| `popup.html` / `popup.css` / `popup.js` | Popup UI, styles, conversion engine + DOM wiring |
| `icons/` | Generated 16/48/128 PNG icons |

## Permissions

- `storage` — remembers your stride length and pace.

## Privacy

Everything runs in the popup. Nothing is collected, stored remotely, or transmitted.
