# Image Canvas — Rotate & Merge

Load local images, rotate each in 90° steps, merge them side-by-side or stacked with an adjustable gap and background color, then download the result as PNG.

## Honest scope

- **Images only.** This extension does not operate on PDF pages and cannot rotate, split, or merge PDFs.
- All processing happens on a `<canvas>` on your device. Images are never uploaded anywhere.
- Rotation persists per file name in `chrome.storage.local` so repeat visits remember your edits.

## Layout math

- Side-by-side: total width = sum of widths + gaps; images vertically centered.
- Stacked: total height = sum of heights + gaps; images horizontally centered.
- Gap clamped to 0–100px.

## Files

- `manifest.json` — MV3, permissions: `storage` only
- `popup.html` / `popup.css` / `popup.js` — UI + engine
- `icons/` — generated PNG icons (16/48/128)

## Testing

Run `node --check popup.js` for syntax. Headless engine tests cover `rotatedSize` (90/270 swap, 180/360 same, negative normalize), `mergeSize` (side-by-side, stacked, gap clamping, empty), and `rotationSteps`.
