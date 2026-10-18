# Image Dimension & Aspect Ratio Inspector — v1.0.0

Scan every `<img>` on the current page: natural vs. displayed dimensions,
aspect ratio (reduced, e.g. `16:9`), lazy-load and broken status, and transfer
size when the browser's Resource Timing API can see it. Click any card to
scroll to the image and flash-highlight it on the page.

## Features

- One-click scan of all page images (injected only on demand)
- Natural vs. displayed dimensions, e.g. `1920×1080 → 640×360 px`
- Aspect ratio reduced via GCD (`16:9`), decimal fallback for odd ratios
- `LAZY` / `BROKEN` badges, broken-only filter
- Transfer-size totals from the Resource Timing API (honest "—" when unavailable)
- Click-to-highlight: smooth-scrolls and flashes an emerald outline
- Per-tab cached results — reopening the popup restores the last scan

## Install

**Chrome / Edge**
1. Unzip `image-dimension-aspect-ratio-inspector.zip`
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
| `activeTab` | Read the current tab's URL and inject the scanner only after you click Scan |
| `scripting` | Inject `content.js` on demand to read image data |
| `storage` | Cache the last scan per tab on-device |

No host permissions, no network calls. All data stays on-device.

## Publishing notes

- Manifest V3, no deprecated APIs.
- Read-only: the only page change is a temporary 1.6 s highlight outline.
- Transfer sizes come from `performance.getEntriesByType('resource')`; cross-origin
  images without Timing-Allow-Origin headers report nothing — shown honestly as "—".
- Content scripts cannot run on `chrome://`, `edge://`, Web Store, or `about:`
  pages — the popup explains this when scanning is unavailable.
- No remote code, no data collection — store-review friendly.
