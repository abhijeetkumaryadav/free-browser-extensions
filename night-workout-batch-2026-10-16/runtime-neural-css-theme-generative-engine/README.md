# Theme Forge — Generative CSS Theme Engine

v1.0.0 · Manifest V3 · 100% local, zero network.

## What it does

**Theme Forge** generates cohesive CSS color themes using pure **color math** —
hue rotations on the color wheel (analogous, complementary, triadic, tetradic,
monochrome schemes) plus a seedable random generator.

- **Sliders** for base hue, saturation, lightness
- **Scheme picker** for classic harmony rules
- **Seedable "Generate"** button — same seed reproduces the same theme
- **Live preview** of the palette applied to sample UI (heading, body, buttons, badge)
- **Palette swatches** — click any swatch to copy its hex
- **Save named themes** (local storage, up to 50)
- **Export as CSS variables** — downloads a `.css` file with `:root` variables

## Honest scope

> **Color-math generator — not neural.** There are no models, no AI, and no
> network calls. "Generative" here means seeded random palette generation
> from deterministic color-harmony rules.

## Permissions

- `storage` — persists saved themes and last-used settings. Nothing else.

## Files

- `manifest.json` — MV3 manifest
- `popup.html` / `popup.css` / `popup.js` — popup UI; the engine (scheme
  offsets, mulberry32 PRNG, HSL→hex, theme builder, CSS exporter) lives
  between `// ENGINE-START` and `// ENGINE-END` markers and is unit-tested
  headlessly in Node
- `icons/` — 16/48/128 PNG icons

## Usage

1. Pick a scheme or leave Analogous.
2. Drag the hue/sat/light sliders for manual control.
3. Hit **Generate** for a seeded random theme (leave seed empty for a random one).
4. Click swatches to copy hex values.
5. Name and **Save** themes you like; **Load** or delete them later.
6. **Export current as CSS variables** to get a ready-to-use `.css` file.
