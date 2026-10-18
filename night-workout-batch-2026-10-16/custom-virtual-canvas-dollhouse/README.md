# Canvas Dollhouse

A tiny interactive dollhouse that lives in your new tab. Fully local creative toy — no network, no tracking.

## Features
- **3 rooms** (Living Room, Bedroom, Kitchen), each with its own wall color, light state, and furniture layout
- **13 hand-drawn SVG furniture pieces** — sofa, armchair, bed, fridge, stove, TV, plant, rug, lamp, and more
- **Drag to arrange** — pointer-based dragging, constrained to the room; click a piece then ✕ to remove
- **Wall color picker** and **lights toggle** (cozy dim mode) per room
- Layouts persist in `chrome.storage.local` — your house is still there tomorrow

## Install
1. Open `chrome://extensions`, enable Developer mode
2. Load unpacked → select this folder (or install the `.zip`)

Opening a new tab shows your dollhouse. The popup offers a shortcut plus a two-click reset.

## Permissions
- `storage` — saves your room layouts only

## Honest scope
A creative toy. Everything is drawn locally with inline SVG/CSS; nothing leaves the device.
