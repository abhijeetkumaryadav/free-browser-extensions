# Thumbnail Pixel Score — Contrast & Saturation

Load a local image; the popup downscales it on a canvas and computes pixel statistics:
**contrast** (luminance standard deviation, scaled 0–100) and **saturation** (mean HSL
saturation, scaled 0–100). The 0–100 overall score is the mean of the two, shown on a
ring with per-channel plain-language notes.

## Honest scope
- **Pixel math only — not ranking advice.** A high score does not mean more views.
- Image never leaves your machine; analyzed on a downscaled canvas.
- Contrast uses relative-luminance stddev; saturation uses mean HSL saturation.

## Features
- Click or drag-drop a local image
- 0–100 score ring + verdict (High pop / Moderate / Low pop)
- Contrast and saturation bars
- Per-channel readable notes
- Last result restored locally

## Files
- `manifest.json` — Manifest V3, `storage` only
- `popup.html` / `popup.css` / `popup.js` — UI; engine between `ENGINE-START`/`ENGINE-END`
- `icons/` — 16/48/128 PNG

## Design
380px popup, deep-dark glassmorphism, single amber `#f59e0b` accent, Lucide-style outline icons.
