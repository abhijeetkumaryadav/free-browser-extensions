# ShadeForge — Tailwind Shade Generator

Generate a 10-step Tailwind-style shade scale (**50 → 900**) from any base color, entirely offline.

## What it does

- Pick a base color with the color picker, type a hex value, or roll a random color.
- Generates steps 50, 100, 200, 300, 400, 500, 600, 700, 800, 900 using **HSL lightness interpolation** around the base color (anchored at 500).
- Click any swatch to copy its hex.
- Export the scale as a **Tailwind config snippet**, **CSS variables**, or **JSON**; name your color token (e.g. `brand`).
- Last base color, name, and export mode are remembered locally.

## Honest scope

The scale is an **approximation** built from lightness/saturation curves — it is not the official Material Design or Tailwind palette. Always eyeball contrast for text usage.

## Install

1. Download / unzip this folder.
2. Open `chrome://extensions` (Edge: `edge://extensions`), enable **Developer mode**.
3. **Load unpacked** → select the extension folder.
4. Click the toolbar icon to open ShadeForge.

Same steps apply to Firefox (temporary add-on via `about:debugging`) and Opera.

## Permissions

- `storage` — remembers your last base color, token name, and export mode. Nothing leaves the device.

## Privacy / publishing notes

- Zero network requests. No analytics, no remote code, no tracking.
- MV3 only. Safe for Chrome Web Store submission as a design utility.
