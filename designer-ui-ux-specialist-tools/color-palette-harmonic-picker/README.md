# Chroma — Color Palette Harmonic Picker

A color harmony studio for designers and developers. Pick a base color and
generate harmonic palettes, copy any swatch with one click, save favorites,
and export as CSS variables.

## Features

- **Base color input** — native color picker, hex text field, and an
  on-screen eyedropper (Chromium via the EyeDropper API; disabled gracefully
  elsewhere).
- **6 harmony modes** — Complementary, Triadic, Analogous,
  Split-complementary, Tetradic, Monochromatic. All math is pure HSL computed
  client-side.
- **Click-to-copy swatches** — every swatch copies its hex code.
- **Favorites** — save up to 60 palettes, click to reload, delete individually.
- **Export CSS variables** — copies a `:root { --chroma-1: … }` block.

## Install (developer / unpacked)

1. Unzip `color-palette-harmonic-picker.zip`.
2. Open `chrome://extensions` (Edge: `edge://extensions`).
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the unzipped folder.
5. Firefox: `about:debugging` → This Firefox → Load Temporary Add-on →
   select `manifest.json`.

## Permissions

| Permission | Why it is needed |
|---|---|
| `storage` | Persists your saved favorite palettes on this device only. |

No host permissions, no network calls, no analytics. Everything runs
on-device; nothing is transmitted anywhere.

## Publishing notes

- Manifest V3, no deprecated APIs.
- Minimal permission set (`storage` only) — low review friction on the
  Chrome Web Store and Edge Add-ons.
- EyeDropper usage is Chromium-only; the button degrades gracefully in
  Firefox, which is documented in the UI itself.
