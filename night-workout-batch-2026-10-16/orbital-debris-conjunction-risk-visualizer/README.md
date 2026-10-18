# Conjunction Risk Visualizer

An educational demo of conjunction math: enter miss distance, relative
velocity, and object sizes to get a toy collision-probability estimate with
an animated visualization.

## Honest scope
- **Simplified model only** — Pc ≈ (combined hard-body radius / miss distance)².
- **Not a real conjunction assessment.** Real analysis uses full covariance
  propagation, drag modeling, and encounter geometry. This demo ignores all
  of that and says so in the popup.
- Fully local, zero network; last inputs not stored.

## Files
- `manifest.json` — MV3, `storage` permission only
- `popup.html` / `popup.css` / `popup.js` — UI + engine
- `icons/icon{16,48,128}.png`
