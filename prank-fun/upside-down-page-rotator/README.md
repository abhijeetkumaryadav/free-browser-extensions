# FlipPage — Upside-Down Page Rotator

A harmless prank extension: click **Flip page 180°** and the entire current tab smoothly rotates upside-down. Click again (or **Restore page**) and everything returns to normal. An optional **Shake mode** adds a gentle wobble while flipped.

Everything is clearly labeled as a joke. The effect touches only inline styles on `<html>`, is fully removed on restore, and never persists across reloads.

## Features

- One-click 180° page rotation with a smooth 0.6s CSS transition
- Optional shake mode (gentle ±2.5° wobble animation)
- Live status in the popup: knows whether the tab is flipped or not
- Graceful message on browser-restricted pages (chrome://, Web Store)
- Reversible, no page damage, no data collected

## Install (Chrome / Edge / Opera)

1. Download and unzip `upside-down-page-rotator.zip`
2. Open `chrome://extensions` and enable **Developer mode**
3. Click **Load unpacked** and select the unzipped folder

## Install (Firefox)

Firefox supports most MV3 extensions via `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → select `manifest.json`. The `chrome.*` APIs used here are compatible with Firefox's `chrome` namespace.

## Permissions

| Permission | Why |
|---|---|
| `activeTab` | Flip only the tab you click the button for |
| `scripting` | Inject the flip content script on demand (user gesture only) |
| `storage` | Remember your shake-mode preference on-device |

No network calls. No data leaves your device.

## Publishing notes

- MV3 only, no deprecated APIs.
- Prank/joke category — the effect is clearly labeled in-product and instantly reversible.
- `content.js` runs only after an explicit popup click; it never runs automatically.
- Icons are generated PNGs (16/48/128).
