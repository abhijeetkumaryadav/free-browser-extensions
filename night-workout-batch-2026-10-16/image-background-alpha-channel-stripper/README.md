# Alpha Channel Stripper

Flatten a transparent PNG onto a solid background — entirely on your device.

## What it does

1. **Upload an image** — drag & drop or click to choose (PNG with transparency is the point).
2. The extension **analyzes the alpha channel** and tells you what share of pixels are
   fully or semi-transparent.
3. **Pick a background color** — color picker plus quick swatches — and watch the
   before/after preview (the "before" sits on a checkerboard so transparency is visible).
4. **Flatten alpha** composites the image over your color at full resolution and gives
   you a download in PNG, JPEG, or WebP.

## Honest scope

- **100% local canvas work, zero network.** Your image never leaves this machine.
- Your original file is never modified — only the downloaded copy is flattened.
- JPEG output is lossy by nature (quality 0.92); PNG output is lossless.
- Nothing is uploaded, nothing is tracked. No permissions beyond `storage`.

## Files

- `manifest.json` — Manifest V3, `storage` permission only
- `popup.html` / `popup.css` / `popup.js` — UI and the flattening logic
- `icons/` — 16/48/128 PNG icons
