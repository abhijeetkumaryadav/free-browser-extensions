# Messier Visibility Tonight v1.0.0

What Messier deep-sky objects are up tonight — computed for **your** latitude/longitude with real spherical-astronomy math, from a bundled catalog of 31 showpiece objects (RA/Dec, magnitude, type).

## What it does

- Enter latitude/longitude (remembered locally) and a date, hit **Compute visibility**.
- Each object's altitude is computed over the local night (18:00–06:00, sampled every 30 min) using Julian date → GMST → local sidereal time → altitude.
- Shows every object peaking above 20°, sorted by peak altitude, with hours-above-20° and magnitude.

## Honest scope

- **Approximate geometry — not weather-aware.** It computes where objects are in the sky, not whether clouds, moonlight, or light pollution will let you see them.
- Catalog positions are approximate; no precession correction.

## Privacy

Fully local. `storage` permission only for your saved lat/lon. No network calls, no analytics.

## Install (developer mode)

1. `chrome://extensions` → enable **Developer mode**.
2. **Load unpacked** → select this folder.
3. Click the toolbar icon and set your location.
