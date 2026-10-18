# GBP Photo Optimizer — Business Profile Photo Prep

Get your photos ready for a Google Business Profile. Drop in a photo and the extension
checks it against GBP's public photo guidelines, then resizes/crops and compresses it
to a compliant, fast-loading JPEG — all on your device.

## What it does

- **Guideline check** — verifies JPG/PNG format, ≥720px on each side, and 10 KB – 5 MB
  file size, with pass/fail/warn badges per rule.
- **Photo-type profiles** — General (keeps aspect, caps longest side at 1600px),
  Cover (crops to 1024×576, 16:9), Logo (crops to 720×720, 1:1).
- **Client-side optimization** — adjustable JPEG quality (60–95%), before/after
  preview with dimensions and file sizes, one-click download.
- **100% on-device** — your photos are never uploaded anywhere.

## Install

1. Unzip `google-my-business-photo-optimizer.zip`.
2. Open `chrome://extensions` (Edge: `edge://extensions`), enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.
4. Firefox: `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → `manifest.json`.

## Permissions

- `storage` — remembers your photo-type and quality preferences. Nothing else.

## Publishing notes

- Manifest V3, no remote code, no network calls.
- Guideline numbers (720px minimum, 10 KB–5 MB, JPG/PNG) come from Google's public
  Business Profile photo help; re-check them if Google updates its docs.

## Limitations

- Always exports JPEG (PNG transparency is flattened on a white background).
- Aspect-ratio warnings use a ±3% tolerance; covers/logos are center-cropped.
