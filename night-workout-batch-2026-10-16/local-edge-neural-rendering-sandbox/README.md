# Canvas Effects Sandbox

Classic canvas image-effects sandbox: load a local image, apply bundled pixel-level filters, and export the result as a PNG.

## ⚠️ Honest scope

**Classic canvas filters — NOT neural/AI rendering.** All effects are hand-written pixel operations (mosaic downsampling, luminance remapping, channel splitting, dot screens, Sobel convolution). No models, no inference, no network.

## Effects

- **None** — original image
- **Pixelate** — mosaic downsampling (strength = cell density)
- **Duotone** — luminance mapped onto a cyan two-tone ramp
- **Glitch** — RGB channel split plus displaced scanline rows
- **Halftone** — newspaper dot screen from luminance
- **Edge detect** — Sobel convolution edge map

Strength slider (0–100) controls intensity; effect + strength persist in `chrome.storage.local`.

## Privacy

- Images stay in the popup's memory; the only download is the PNG you explicitly export.
- No network requests, no analytics.

## Files

- `manifest.json` — Manifest V3 (`storage` permission only)
- `popup.html` / `popup.css` / `popup.js` — UI and filter engine
- `icons/` — generated PNG icons

## Build

Icons were generated with Python PIL. No build step, no dependencies.
