# Calm Mode — Content Density Attenuator

## What it is
A one-click reading declutter for the active tab: hides common clutter elements (ads, popups, sidebars, cookie banners, promo bars) and can dim non-text areas (images, video, embeds, nav) so text stands out.

## Honest scope
- **Heuristic declutter**: matches common clutter selectors — sites with unusual markup may be missed or partially decluttered.
- **Fully reversible**: toggling off removes every injected style and unhides all nodes; the page DOM is never modified (visibility only).
- Internal browser pages (`chrome://` etc.) are off-limits.

## Privacy
- No tracking; only the dim-level preference is stored locally.
- Injection happens only on user toggle (click-only).

## Permissions
- `storage` — dim preference.
- `activeTab` + `scripting` — inject the declutter engine on user action.

## Files
- `manifest.json`, `background.js`, `content.js` (declutter engine), `popup.html`, `popup.css`, `popup.js`
- `icons/icon16.png`, `icons/icon48.png`, `icons/icon128.png`
