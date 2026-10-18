# ContrastCheck — WCAG Contrast Ratio Checker

Enter a **text (foreground)** and **background** color to get the live **WCAG 2.x contrast ratio**, pass/fail badges for **AA / AAA × normal / large text**, a live text preview, and a **concrete fix suggestion** (the smallest lightness tweak that reaches the target ratio).

## Features

- Native color pickers + editable HEX fields, with input validation
- Big live ratio readout, color-coded (green ≥ 7, amber ≥ 4.5, red below)
- Four badges: AA Normal (4.5:1), AAA Normal (7:1), AA Large (3:1), AAA Large (4.5:1)
- Smart suggestions: e.g. *"Darken the text to `#595959` to reach AA (4.5:1)"* — computed, not generic advice
- Live preview of normal + large text in your chosen colors
- Swap, reset, and one-click **Copy result** (ratio + all four verdicts)
- Last-used colors autosave locally
- 100% local — no page access, no network, no accounts

## Install (developer mode)

**Chrome / Edge / Opera:**
1. Download and unzip `contrast-ratio-wcag-compliance-checker.zip`
2. Open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**
3. Click **Load unpacked** and select the unzipped folder

**Firefox:**
1. Open `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on**
2. Select the `manifest.json` inside the unzipped folder
   (Temporary add-ons unload when Firefox closes; for permanent install the extension must be signed via addons.mozilla.org.)

## Permissions

| Permission | Why |
|---|---|
| `storage` | Remembers your last-used foreground/background colors locally. Nothing else. |

No `host_permissions`, no content scripts, no network requests. The extension only runs inside its own popup.

## Notes for store publishing

- MV3, single `storage` permission, no remote code, no data collection — low review friction
- Screenshots: show the ratio readout + badges + fix suggestion flow
- Privacy policy can state: "All calculations happen on-device; no data is transmitted or stored remotely."
- This is a design-aid calculator implementing the WCAG 2.x relative-luminance formula; it does not replace a full accessibility audit.

## Project layout

- `manifest.json` — MV3 manifest
- `popup.html` / `popup.css` / `popup.js` — UI, dark glassmorphism theme, WCAG math + suggestion engine
- `icons/` — generated 16/48/128 PNG icons
