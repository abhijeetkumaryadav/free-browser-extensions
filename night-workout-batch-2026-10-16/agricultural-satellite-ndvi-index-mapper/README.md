# NDVI Grid — Field Health Mapper

A local NDVI (Normalized Difference Vegetation Index) toolkit for education and field planning.

## What it does

- **NDVI calculator** — enter NIR and Red surface reflectance (0–1) and get the index via the standard formula `NDVI = (NIR − Red) / (NIR + Red)`, with an interpretation band. Bundled sample readings (healthy wheat, stressed maize, bare soil, water, dense forest) demonstrate typical values.
- **Field grid mapper** — paint an 8×8 grid with NDVI values (slider or presets), see live average NDVI and color-coded health, import/export the grid as CSV, and persist it locally.
- **Bands reference** — standard vegetation-health interpretation bands.

## Honest scope

Satellite NDVI imagery requires commercial API keys and is not available to a lightweight extension. This tool computes the index **locally from values you provide** and is intended for learning and rough field planning. It is **not live satellite data** — always verify conditions in the field.

## Permissions

- `storage` — saves your painted field grid locally.

## Install (developer mode)

1. Open `chrome://extensions`, enable **Developer mode**.
2. Click **Load unpacked** and select this folder.
3. Click the toolbar icon to open the popup.
