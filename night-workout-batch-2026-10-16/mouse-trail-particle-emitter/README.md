# Mouse Trail Particle Emitter

A playful visual toy: sparkling particle trails follow your cursor on any page.

## What it does

- Click **Start trail** — colorful particles (sparkles, bubbles, or embers) trail your cursor.
- Choose style, color (fuchsia / cyan / lime / amber), and intensity (Gentle / Medium / Wild).
- Settings update a running trail live.

## Honest scope

- **Visual toy only.** All particles render on a single full-viewport `<canvas>` overlay with `pointer-events: none`.
- The page DOM is **never modified** — no elements are touched, moved, or restyled.
- Click **Stop trail** or press **Esc** on the page to remove the overlay instantly. Nothing persists on the page.
- 100% local. No network requests, no analytics, no data leaves your browser.

## Permissions

- `activeTab` + `scripting` — inject the overlay content script on the tab you click Start on, only when you click it.
- `storage` — remember your style/color/intensity preferences.

## Files

- `manifest.json` — Manifest V3
- `popup.html` / `popup.css` / `popup.js` — settings UI
- `content.js` — canvas particle engine
- `icons/` — generated PNG icons (16/48/128)

## Install

1. Open `chrome://extensions` (or `edge://extensions`), enable Developer mode.
2. Click **Load unpacked** and select this folder.
3. Pin the extension and click its icon to open the trail controls.
