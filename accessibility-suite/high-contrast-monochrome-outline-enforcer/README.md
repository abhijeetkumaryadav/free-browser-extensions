# MonoFocus — High-Contrast Outline Enforcer

Force a high-contrast monochrome treatment plus strong, always-visible outlines onto any page. Built for low-vision browsing, focus visibility and demos. User-triggered, per-tab, fully reversible.

## Presets

- **Mono Boost** — grayscale + contrast boost; interactive elements outlined.
- **Night Contrast** — inverted monochrome (dark page, bright content); media is re-inverted so photos don't look like negatives.
- **Focus Rings** — no filter; just strong outlines on links, buttons, inputs and focus targets.

## Outline width

Slider from 1–8px. Outlines use a white ring + black halo so they stay visible on any background.

## Usage

1. Open any page.
2. Click the MonoFocus icon, pick a preset, set outline width.
3. Flip **Enforce on this tab**. Flip again to revert instantly.

Settings persist across popup opens; enforcement is per-tab (switching tabs does not carry it over).

## Notes

- Heavy `filter` on `html` can slow very complex pages; use **Focus Rings** if a page feels sluggish.
- `chrome://` and extension pages cannot be modified (browser restriction).

## Permissions

- `activeTab` + `scripting` — inject the contrast stylesheet into the current tab only when you flip the switch.
- `storage` — remember your preset and outline width.
