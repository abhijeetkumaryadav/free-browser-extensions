# CropCalc — Crop Spacing, Density & Yield Estimator

A pure-local farming calculator: enter row spacing, in-row plant spacing, and
field size to estimate plant population, density, and a yield range.

## Formulas (standard agronomy)

- `plants/m² = 10,000 / (row_cm × plant_cm)`
- `population/ha = plants/m² × 10,000`
- `effective stand = population × germination%`
- `yield kg/ha = effective stand × yield per plant (kg)`
- Shown range: **±20%** around the expected value, clearly labeled an estimate

## Presets

Maize, wheat, rice, soybean, cotton, potato, tomato, onion — each fills typical
spacing and per-plant yield values. Everything is editable; presets are starting
points from agronomy references, not guarantees.

## Honest scope

Estimates only. Real yield depends on soil, weather, variety, pests, and
management. No network calls, no accounts — all math runs in the popup.

## Install (developer mode)

1. Open `chrome://extensions`, enable **Developer mode**
2. **Load unpacked** → select this folder

## Permissions

| Permission | Why |
|---|---|
| `storage` | Remember your last inputs locally |

## Files

- `manifest.json` — MV3 manifest
- `popup.html` / `popup.css` / `popup.js` — 380px glassmorphism popup + calculator
- `icons/` — generated 16/48/128 PNG icons

## Publishing notes

No data collection, no remote code. Provide a privacy policy stating no data
is collected.
