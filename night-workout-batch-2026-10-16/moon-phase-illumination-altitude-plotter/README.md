# Moon Phase & Altitude Plotter v1.0.0

Moon phase, illumination, age, sky position and distance for your location and time — computed **locally** with a standard low-precision lunar algorithm (Paul Schlyter's method with the major perturbation terms).

## What it does

- Enter latitude/longitude (remembered locally) and a time, hit **Compute moon**.
- Shows phase name, % illuminated, moon age, altitude, azimuth with compass direction, and distance in km.
- Canvas illustration draws the current phase.

## Honest scope

- **Approximate algorithm** — position is good to a few arcminutes; phase and illumination are accurate to well under 1%. Not for navigation or eclipse prediction.

## Privacy

Fully local. `storage` permission only for your saved lat/lon. No network calls, no analytics.

## Install (developer mode)

1. `chrome://extensions` → enable **Developer mode**.
2. **Load unpacked** → select this folder.
3. Click the toolbar icon and set your location.
