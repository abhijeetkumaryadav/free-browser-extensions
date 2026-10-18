# CrackScreen — Fake Screen Shatter Prank

A harmless prank extension: click **Shatter this tab** and a fake cracked-screen effect spreads across the current tab with a synthesized shatter sound (Web Audio, no audio files). A big **"😅 JUST KIDDING — click to restore"** button removes the effect instantly.

Everything is clearly labeled as a joke. The overlay is purely visual (closed shadow-DOM canvas) — the page underneath is never modified, and nothing persists.

## Features

- Fake crack effect: jagged cracks radiating from screen center with impact rings, revealed progressively over ~0.5s
- Synthesized shatter sound (noise burst + low thump via Web Audio API) — toggleable
- Crack intensity: Light / Medium / Heavy
- One-click restore; clicking the popup button again also toggles the effect off
- Reversible, no page damage, no data collected

## Install (Chrome / Edge / Opera)

1. Download and unzip `screen-shatter-fake-crack-simulator.zip`
2. Open `chrome://extensions` and enable **Developer mode**
3. Click **Load unpacked** and select the unzipped folder

## Install (Firefox)

Firefox supports most MV3 extensions via `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → select `manifest.json`. The `chrome.*` APIs used here are compatible with Firefox's `chrome` namespace.

## Permissions

| Permission | Why |
|---|---|
| `activeTab` | Run the crack overlay only on the tab you click the button for |
| `scripting` | Inject the overlay content script on demand (user gesture only) |
| `storage` | Remember your sound / intensity settings on-device |

No network calls. No data leaves your device.

## Publishing notes

- MV3 only, no deprecated APIs.
- Prank/joke category — the effect is clearly labeled in-product and instantly reversible.
- `content.js` runs only after an explicit popup click; it never runs automatically.
- Icons are generated PNGs (16/48/128).
