# TieDye — RGB Page Color Cycler v1.0.0

A harmless prank extension: with one click, the current page's background cycles
through animated rainbow / tie-dye color layers. **The page itself is never
modified** — the effect is a non-interactive overlay, and **Stop / restore**
removes it instantly.

## Features
- 6 palettes: Rainbow, Pastel, Neon, Inferno, Ocean, Grayscale
- Speed slider (Chill → Wild)
- 4 blend styles (Screen, Overlay, Multiply, Difference)
- Overlay + note toast removed cleanly on stop — fully reversible
- Settings (palette / blend / speed) remembered in `chrome.storage.local`

## Honest scope
This is a **joke**. It does not change page content, track anything, or call the
network. The animation is CSS-only and pointer-events are disabled, so the page
stays fully clickable underneath.

## Install
- **Chrome / Edge:** unzip → `chrome://extensions` (or `edge://extensions`) →
  enable **Developer mode** → **Load unpacked** → select this folder.
- **Firefox:** MV3 + `chrome.*` APIs are Chromium-only in places (`chrome.tabs`
  exists in Firefox, but `executeScript` via `chrome.scripting` needs Firefox
  110+ and host permissions declared). Provided as-is for Chromium browsers.

## Permissions
| Permission | Why |
|---|---|
| `activeTab` | Run the overlay on the tab you clicked on, only when you click |
| `scripting` | Inject the self-contained `tiedye.js` into that tab on demand |
| `storage` | Remember your palette / blend / speed between popup opens |

## Publishing notes
- Manifest V3, no remote code, no analytics.
- The injected function is fully self-contained (files, then invoke — no
  `eval`, no `new Function`), satisfying MV3 CSP.
