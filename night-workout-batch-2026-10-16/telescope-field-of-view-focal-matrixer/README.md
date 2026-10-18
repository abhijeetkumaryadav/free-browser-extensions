# FOV Matrix — Telescope Field-of-View Calculator

A field-of-view calculator for telescope + camera setups, using textbook optics math.

## What it does

- **Setup inputs** — focal length, optional aperture, sensor width/height, optional eyepiece focal.
- **Live results** — horizontal / vertical / diagonal FOV in degrees, eyepiece magnification, focal ratio.
- **Comparison matrix** — save named setups and compare their FOV numbers side by side; delete per setup or clear all.

## Math

- `FOV = 2 · arctan(d / 2f)` for sensor dimension `d` and focal length `f`
- Magnification = telescope focal ÷ eyepiece focal
- Focal ratio = focal length ÷ aperture

## Honest scope

**Textbook optics math.** Idealized thin-lens formulas — ignores optical distortion, field curvature, and vignetting. Magnification values are theoretical.

## Permissions

- `storage` — saved setups in `chrome.storage.local`.

## Files

- `manifest.json` — MV3 manifest
- `popup.html` / `popup.css` / `popup.js` — UI; pure engine between `// ENGINE-START` / `// ENGINE-END`
- `README.md`, `icons/`

Fully local — zero network.
