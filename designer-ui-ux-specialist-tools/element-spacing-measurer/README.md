# Element Spacing Measurer — v1.0.0

Measure pixel distances between any two elements on the page. Click **Measure
elements**, then click two elements: the extension draws guide lines with
horizontal, vertical, and diagonal readouts on a non-destructive overlay.

## Features

- Hover highlighting with dashed cyan outline while picking
- Edge-gap measurement (0 px on an axis when elements overlap there)
- Diagonal connector between nearest points + dashed H/V projections
- Persistent overlay that stays glued while scrolling; Clear button removes it
- Last-12 measurement history stored on-device
- `Esc` cancels measure mode at any time

## Install

**Chrome / Edge**
1. Unzip `element-spacing-measurer.zip`
2. Open `chrome://extensions` (or `edge://extensions`)
3. Enable **Developer mode**
4. **Load unpacked** → select the unzipped folder

**Firefox**
1. Open `about:debugging#/runtime/this-firefox`
2. **Load Temporary Add-on** → choose `manifest.json`
   (temporary: removed when Firefox restarts)

## Permissions — why each is needed

| Permission | Justification |
|---|---|
| `activeTab` | Read the current tab's URL and inject the measure tool only after you click the button |
| `scripting` | Inject `content.js` on demand to highlight elements and draw the overlay |
| `storage` | Save measurement history and the last result on-device |

No host permissions, no network calls. All data stays on-device.

## Publishing notes

- Manifest V3, no deprecated APIs.
- The overlay is injected only on explicit user action; it never modifies page content and is fully removed on Clear.
- Content scripts cannot run on `chrome://`, `edge://`, Web Store, or `about:` pages — the popup explains this when measuring is unavailable.
- No remote code, no data collection — store-review friendly.
