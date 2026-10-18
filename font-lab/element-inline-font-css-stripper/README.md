# FontStrip — Inline Font CSS Stripper

A developer utility: with one click, strips inline `style` font properties
(`font-family`, `font-size`, `font-weight`, `font-style`, `letter-spacing`, …)
from every element on the active tab — revealing the site's real stylesheet
typography underneath. Fully reversible: every original `style` attribute is
backed up per element and restored exactly.

## Features
- One-click strip of inline font CSS on the active tab
- Three property groups you can toggle independently:
  - **Font family** (`font-family`)
  - **Font size & line height** (`font-size`, `line-height`)
  - **Weight · style · spacing** (`font`, `font-weight`, `font-style`, `letter-spacing`, …)
- Stats: elements affected + properties removed
- **Restore page** puts every original `style` attribute back exactly
  (backups live on the DOM itself, so restore works even after reopening the popup)
- Badge shows Stripped vs Clean state

## Install (Chrome / Edge / Opera)
1. Download and unzip `element-inline-font-css-stripper.zip`.
2. Open `chrome://extensions`, enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

## Install (Firefox)
`about:debugging` → This Firefox → Load Temporary Add-on → choose `manifest.json`.
(Packaging as a signed `.xpi` is needed for permanent installs.)

## Permissions (justified)
- `storage` — remembers which property groups you ticked, on this device.
- `activeTab` — lets the popup interact with the tab you click it on.
- `scripting` — runs a self-contained function on the active tab (your click only)
  that edits inline `style` attributes and stores exact backups.

No network calls. No data collection. Everything stays on-device.

## Publishing notes
- MV3 only, no remote code, no deprecated APIs.
- `activeTab` + `scripting` on explicit user gesture is the minimal, review-friendly
  pattern for page-editing dev tools. Restricted pages (chrome://, Web Store) are
  refused with a clear message.
- Note for store review: the extension only rewrites inline styles of the page the
  user explicitly activates it on; it never touches other tabs automatically.
