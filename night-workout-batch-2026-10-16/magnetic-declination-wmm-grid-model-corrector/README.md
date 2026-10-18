# Declination Compass — True vs Magnetic North

Honestly narrowed: **your declination — not a WMM model.** This extension explains
magnetic declination and converts true ↔ magnetic bearings using a declination
value **you** enter. It does not know your location, does not fetch any geomagnetic
model, and works fully offline.

## What it does

- Enter your magnetic declination in degrees (east positive, e.g. 12.5 for 12.5°E, -4 for 4°W)
- Enter a bearing; see the converted true → magnetic and magnetic → true results
- 16-wind compass point readout
- Built-in explainer: true vs magnetic north, "East is least, West is best"
- Settings persist locally (chrome.storage.local)

## Formulas

- magnetic = (true − declination) wrapped to 0–360
- true = (magnetic + declination) wrapped to 0–360

## Privacy

Fully local. Zero network requests. No accounts, no telemetry.

## Install

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select this folder
