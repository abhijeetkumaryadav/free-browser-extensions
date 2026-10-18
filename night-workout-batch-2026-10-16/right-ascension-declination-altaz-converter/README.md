# RA/Dec ↔ Alt/Az Converter

Convert between equatorial coordinates (right ascension / declination) and horizontal coordinates (altitude / azimuth) for any location and time.

- **RA/Dec → Alt/Az** — altitude, azimuth (north→east), hour angle, LST, above-horizon flag
- **Alt/Az → RA/Dec** — back to equatorial coordinates
- Real spherical-astronomy math (Julian date → GMST → LST → hour angle)
- Location remembered locally

**Honest scope:** Approximate geometry — educational, not telescope pointing software. No network calls; everything runs locally.

## Install (developer mode)
1. `chrome://extensions` → enable Developer mode → Load unpacked → select this folder.
