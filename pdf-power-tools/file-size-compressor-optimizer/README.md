# ShrinkLab — Image Size Compressor v1.0.0

Compress images on-device: pick files (or drag & drop), set a max dimension,
output format (JPEG / WebP / PNG) and quality, and see before/after sizes with
total savings %. Download individually or all at once. 100% local — zero
network calls, nothing is uploaded.

## Install

**Chrome / Edge**
1. Unzip the package.
2. Open `chrome://extensions`, enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

**Firefox**
1. Open `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on**.
2. Select `manifest.json` (temporary install).

## Usage

1. Drop images or click to choose (images only — no video/PDF).
2. Adjust max dimension, format, and quality. Re-compression is automatic.
3. Review per-file savings and total savings, then **Save** individually or
   **Download all compressed**.

Quality tradeoff: JPEG and WebP are lossy (lower quality = smaller files);
PNG is lossless and ignores the quality slider. JPEG flattens transparency
onto white.

## Permissions

- `storage` — remembers your compression settings. Nothing else.

## Files

- `popup.html` / `popup.css` / `popup.js` — UI + canvas-based compression.
- `icons/` — PIL-generated PNG icons.

## Publishing notes

- MV3, no remote code, no host permissions, no network calls.
- Chrome Web Store: single-purpose "productivity" tool.
