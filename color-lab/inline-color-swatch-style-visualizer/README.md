# SwatchPeek — Inline Color Swatch Visualizer

Paste CSS (or any text with color values) and instantly see a live **swatch chip inline next to every detected color token**. Click any chip to copy that color.

## Features

- Detects **HEX** (`#fff`, `#ec4899`, `#ff000080`), **RGB/RGBA**, **HSL/HSLA**, and all **148 CSS named colors** (case-insensitive)
- Renders the original text with a colored swatch square glued to each token
- Click any swatch to copy the original token; **Copy all as HEX** exports every found color as normalized HEX values
- Live stats (N colors found), draft autosave, invalid tokens are visually flagged
- 100% local — no page access, no network, no accounts

## Install (developer mode)

**Chrome / Edge / Opera:**
1. Download and unzip `inline-color-swatch-style-visualizer.zip`
2. Open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**
3. Click **Load unpacked** and select the unzipped folder

**Firefox:**
1. Open `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on**
2. Select the `manifest.json` inside the unzipped folder
   (Temporary add-ons unload when Firefox closes; for permanent install the extension must be signed via addons.mozilla.org.)

## Permissions

| Permission | Why |
|---|---|
| `storage` | Autosaves your draft text and recent state locally. Nothing else. |

No `host_permissions`, no content scripts, no network requests. The extension only runs inside its own popup.

## Notes for store publishing

- MV3, single optional-ish permission (`storage`), no remote code, no data collection — low review friction
- Screenshots: show pasted CSS with inline swatches + the "Copy all as HEX" flow
- Privacy policy can state: "All processing happens on-device; no data is transmitted or stored remotely."

## Project layout

- `manifest.json` — MV3 manifest
- `popup.html` / `popup.css` / `popup.js` — UI, dark glassmorphism theme, color tokenizer + parser
- `icons/` — generated 16/48/128 PNG icons
