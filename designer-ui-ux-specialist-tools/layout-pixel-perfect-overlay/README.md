# Layout Pixel-Perfect Overlay v1.0.0

Pixel-perfect design comparison: overlay your design mockup image on any live page with adjustable opacity, drag positioning, scale, and blend mode — with per-site memory.

## Features
- **Per-site mockup storage** — pick an image from your files; it's stored on-device (downscaled to fit storage quotas) and remembered for that site.
- **Live adjustments** — opacity (5–100%), scale (10–200%), X/Y position sliders update the page instantly.
- **Drag to position** — grab the orange handle on the overlay and drag it directly on the page.
- **Difference blend mode** — "Invert blend" switches to `mix-blend-mode: difference` for pixel-diff-style comparison.
- **One-click toggle** — show/hide per site; reset position anytime.

## Install
**Chrome / Edge:** unzip → `chrome://extensions` → enable Developer mode → Load unpacked → select the folder.
**Firefox:** unzip → `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → select `manifest.json`.
**Opera:** unzip → `opera://extensions` → Developer mode → Load unpacked.

## Permissions (justified)
| Permission | Why |
|---|---|
| `storage` | Save per-site mockup images and overlay settings (position, opacity, scale). |
| `activeTab` | Identify the current tab's site and inject the overlay only when you open the popup. |
| `scripting` | Inject the overlay content script on demand — never on every page load. |

No host permissions, no network calls, no data leaves the device. Your mockup image is never uploaded anywhere. The overlay is non-destructive: it floats above the page and never modifies page content.

## Honest limitations
- The overlay can't be injected on browser-internal pages (`chrome://`, `about:`, web stores) — a note appears instead.
- Very large mockups are downscaled (longest side 1600px) to fit `chrome.storage.local` quotas.
- The overlay is fixed-position, so it won't scroll with the page — by design, for comparing against a static mockup.

## Publishing notes
- MV3, no deprecated APIs. Minimal justified permissions.
- Chrome Web Store: one-time $5 developer registration + 2-step verification; disclose the three permissions above.
- Edge Add-ons and Firefox Add-ons: free accounts; Firefox requires add-on signing (automatic on upload).
