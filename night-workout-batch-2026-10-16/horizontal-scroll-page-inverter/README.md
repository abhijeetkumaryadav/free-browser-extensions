# ScrollFlip — Horizontal Scroll Inverter

A harmless page toy: flip the horizontal scroll direction, mirror the whole page
layout, or both — with one click, and one click to restore everything.

## Features

- **Flip horizontal scroll** — wheel-left scrolls content right and vice versa.
- **Mirror page layout** — flips the page horizontally via CSS transform.
- **Remember per site** — re-applies your settings on remembered domains.
- **Reset page** — removes all effects instantly; the DOM is never modified.

## Honest scope

This is a toy. It remaps `wheel` deltaX events and applies a `scaleX(-1)` CSS
transform. It does not alter page content, and protected pages (new tab,
settings, web store) are unaffected. Everything is reversible.

## Install (developer mode)

1. Open `chrome://extensions`, enable **Developer mode**.
2. Click **Load unpacked** and select this folder.
3. Click the toolbar icon on any web page and hit a toggle.

## Permissions

- `storage` — saves your toggles and per-site list locally.
- `activeTab` + `scripting` — injects the effect only when you click a toggle.

No network access. No analytics. Nothing leaves the device.

## Publishing notes

- Manifest V3, no deprecated APIs.
- Minimal permissions, all justified above.
- No remote code, no bundled libraries.
