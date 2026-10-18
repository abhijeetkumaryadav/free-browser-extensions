# SteadyCursor — Shaky Mouse Stabiliser

An accessibility **comfort aid** that replaces the page cursor with a large,
high-contrast cursor whose movement is smoothed, reducing visible jitter for
people with shaky hands. Optional click-target magnification enlarges buttons
and links under the cursor.

> **Honest scope:** a comfort aid, not a medical device. It does not diagnose,
> treat, or measure any condition. All processing is local — nothing leaves
> your device.

## Features
- Toggle on the active tab (user-triggered; fully reversible)
- Adjustable smoothing strength (0–90%)
- 5 high-contrast cursor colours, size 20–64px
- Optional click-target magnification (1.25×)
- Settings persist locally via `chrome.storage.local`

## Permissions
- `storage` — persist your settings locally
- `activeTab` + `scripting` — inject the stabiliser only when you enable it

## Install (developer mode)
1. Open `chrome://extensions`, enable **Developer mode**
2. **Load unpacked** → select this folder
3. Click the toolbar icon, enable on any tab

## Files
- `manifest.json` — MV3 manifest
- `popup.html` / `popup.css` / `popup.js` — settings panel
- `content.js` — smoothed cursor overlay + magnification (injected on demand)
- `icons/` — generated PNG icons
