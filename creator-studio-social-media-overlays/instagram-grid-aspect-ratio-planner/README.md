# Instagram Grid Aspect Ratio Planner v1.0.0

Plan your Instagram grid before you post. Add up to 9 images, preview them in a
3-column Instagram-style grid, verify each image's aspect ratio against IG's
recommendations (1:1 square, 4:5 portrait, 1.91:1 landscape), drag to reorder,
and copy the plan as JSON.

## Features

- **3-column grid preview** — see exactly how the 9 tiles sit together.
- **Aspect-ratio badges** — green badge when an image matches an IG preset
  (within 2%), amber "Custom ratio" badge otherwise, plus the simplified
  ratio (e.g. `3:2`) on every tile.
- **Drag to reorder** — HTML5 drag & drop; order persists (metadata only).
- **Copy plan** — exports the ordered plan (name, dimensions, ratio, IG preset)
  as JSON to your clipboard.
- **100% on-device** — images are previewed via object URLs; nothing is
  uploaded, synced, or transmitted anywhere.

## Install (load unpacked)

**Chrome / Edge**
1. Unzip `instagram-grid-aspect-ratio-planner.zip`.
2. Go to `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
3. **Load unpacked** → select the unzipped folder.

**Firefox**
1. Unzip the package.
2. Go to `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** →
   select `manifest.json`. (Note: temporary until packaged/signed for distribution.)

## Permissions (all justified)

| Permission | Why |
|---|---|
| `storage` | Remember the planned tile order (names + dimensions only, no image bytes). |

No host permissions, no content scripts, no network calls.

## Publishing notes

- MV3, no deprecated APIs.
- Single-purpose utility; minimal permission footprint — straightforward for
  Chrome Web Store review. Disclose "does not collect user data" in the privacy tab.
- Clipboard write requires the popup's user gesture (the Copy plan button),
  which is how it's wired.
