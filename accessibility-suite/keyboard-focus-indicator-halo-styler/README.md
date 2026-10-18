# Focus Halo — Keyboard Focus Indicator Styler

A bold, customizable halo around the keyboard-focused element on every page —
an accessibility upgrade for keyboard navigators, with zero tracking.

## Features

- **4 halo styles** — solid ring, glow, underline, dashed ring
- **Color presets + custom picker**, thickness slider (1–8px)
- **Pulse animation** toggle for extra visibility
- **Keyboard-only mode** (default): the halo appears only when focus came from
  the keyboard (Tab/arrows/Enter) — mouse clicks don't trigger it, so it never
  fights with a site's own focus styles during mouse use
- **Live preview** in the popup — Tab through the demo buttons to see it
- Settings apply instantly to all open pages via `storage.onChanged`

## How it works

A lightweight content script (`content.js`) tracks input modality
(`keydown` → keyboard, `mousedown`/`touchstart` → mouse) and on `focusin`
adds a single CSS class to the focused element. All visuals come from one
injected `<style>` tag driven by CSS variables — no layout thrash, no DOM
scanning, no data collection.

## Permissions (minimal, justified)

| Permission | Why |
|---|---|
| `storage` | Persist halo settings locally |
| content script on `http(s)://*/*` | Required to draw the halo on web pages |

No host permissions, no background page, no network calls, no analytics.

## Files

- `manifest.json` — MV3 manifest
- `popup.html` / `popup.css` / `popup.js` — settings UI
- `content.js` — halo overlay logic
- `icons/icon-{16,48,128}.png` — generated icons

## Notes

- Content scripts cannot run on `chrome://`, `edge://`, or web-store pages
  (browser restriction) — the halo simply won't appear there.
- The halo never targets `<body>` itself, only genuine focusable elements.
