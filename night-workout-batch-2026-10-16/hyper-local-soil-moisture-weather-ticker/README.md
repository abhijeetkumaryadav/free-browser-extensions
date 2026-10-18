# Garden Bed Log

A manual garden watering logbook: track watering and soil observations per bed, see watering intervals and bed status at a glance.

## Honest scope (read this first)

- ✅ **Manual logbook** — every entry is typed by you.
- ✅ Watering intervals, "due/overdue" status, and averages are computed from **your own logs**.
- ❌ **NOT live soil sensors.** There is no hardware connection.
- ❌ **NOT live weather data.** Weather notes are text you type yourself.
- 100% local, zero network. All data lives in `chrome.storage.local`.

## Features

- **Beds** — add beds with plant names and a typical watering interval (days)
- **Log entry** — date, watered yes/no, water amount (ml), soil moisture on a 1–5 feel-test scale, your typed weather note, free notes
- **Dashboard** — per-bed status chips (OK / Due / Overdue), last watered, days since, average interval, target interval; latest weather notes
- Recent entries list; delete a bed (removes its entries too)

## Files

| File | Purpose |
|---|---|
| `manifest.json` | MV3 manifest, `storage` permission only |
| `popup.html` / `popup.css` / `popup.js` | Popup UI, styles, logic |
| `icons/` | Generated PNG icons |

## Permissions

- `storage` — beds and log entries. Nothing else is requested.

## Build validation

- `manifest.json` parses, Manifest V3
- `node --check` passes on `popup.js`
- Icons generated at 16/48/128 px
- `<slug>.zip` contains `manifest.json` at the zip root
