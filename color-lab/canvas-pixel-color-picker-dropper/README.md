# DropPix — Pixel Color Picker v1.0.0

Pick any color on screen with the native EyeDropper API, or sample pixels from an uploaded image with a zoom magnifier. HEX / RGB / HSL readouts, click-to-copy, and a persistent color history.

## Install (developer mode)

**Chrome / Edge:**
1. Unzip `canvas-pixel-color-picker-dropper.zip`.
2. Go to `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

**Firefox:** not supported for the screen picker (EyeDropper API is Chromium-only); the image sampler works in any modern browser when sideloaded via `about:debugging`.

## Permissions

- `storage` — saves your color history locally on the device. Nothing leaves the browser.

## Notes

- The **EyeDropper API** is available in Chrome and Edge. In browsers without it, the "Pick from screen" button is disabled and you can sample from an uploaded image instead.
- Press **Esc** to cancel an active screen pick.
- All sampling happens locally via `<canvas>` — images are never uploaded anywhere.

## Publishing notes

- Single purpose, minimal permissions, no remote code, no network calls — store-friendly.
- Provide a 1280×800 promo screenshot and a short demo video showing the screen picker in action.
