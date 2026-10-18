# Compress — Canvas Image Optimizer

Shrink local images right in your browser. No uploads, no servers, no accounts.

## What it does

- Load any local image (drag & drop or click to choose).
- **Scale slider** (10–100%) — downscale dimensions before encoding.
- **JPEG quality slider** (0.10–1.00) — trade quality for size.
- **Before/after size comparison** — original size, compressed size, percent saved.
- **Download** the compressed JPEG (`<name>-compressed.jpg`).

## Honest limits

- **Re-encodes images.** JPEG compression discards detail; some quality loss
  is expected, especially at low quality settings. Keep your originals.
- PNG transparency becomes a JPEG (no alpha channel).
- Animated images: only the first frame is encoded.

## Privacy

Everything happens on your device via canvas + `URL.createObjectURL`.
Object URLs are revoked after use; nothing is uploaded anywhere.
The only permission is `storage` (currently unused, reserved for future settings).

## Validation

- `manifest.json` parses, Manifest V3.
- `node --check` passes on all JS.
- Headless engine tests: 13/13 pass (settings clamping, output dims,
  byte formatting, saved-percent math).
