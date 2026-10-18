# ChromaSim — Color Blindness Simulator

Preview how any web page looks under common forms of color vision deficiency, right in the tab.

## What it does

- On your click, applies an SVG `feColorMatrix` filter to the **current tab only**:
  - **Protanopia** (red-blind)
  - **Deuteranopia** (green-blind)
  - **Tritanopia** (blue-blind)
  - **Achromatopsia** (no color)
- One-click **Restore normal vision** removes the filter exactly.
- The popup probes the tab on open and shows whether a simulation is active; your last choice is remembered.

## Honest scope

The matrices (Machado et al. 2009-style) are a widely used **approximation** for design review — this is **not a medical test** and does not diagnose anything. It also does nothing on restricted pages (`chrome://`, the Web Store, new-tab).

## Install

1. Download / unzip this folder.
2. Open `chrome://extensions` (Edge: `edge://extensions`), enable **Developer mode**.
3. **Load unpacked** → select the extension folder.
4. Click the toolbar icon, pick a simulation.

## Permissions

- `activeTab` — lets the extension touch the tab you click it on, nothing else.
- `scripting` — injects the self-contained filter functions on your click.
- `storage` — remembers your last simulation choice.

## Privacy / publishing notes

- Zero network requests. No analytics, no remote code, no tracking.
- User-gesture-only injection, fully reversible. Safe for Chrome Web Store submission as an accessibility/design tool.
