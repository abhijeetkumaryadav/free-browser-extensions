# ZoomStep — Text Size Stepper

Step the current page's zoom up or down in 10% steps, with per-site memory —
an accessibility aid for comfortable reading.

## What it does

- **− / + step buttons** — native page zoom in 10% steps (50%–300%).
- **Reset to 100%** — one click back to default.
- **Remember for this site** — the chosen zoom is re-applied automatically
  whenever you visit that site again (a background service worker re-applies
  it after each page load).
- **Saved sites list** — review and forget per-site zooms.
- Keyboard: `+` / `-` / `0` while the popup is open.

## Honest scope

This uses the browser's **native page zoom**, which scales text and layout
together. That's deliberate: text-only scaling breaks layouts on most modern
sites, while native zoom keeps everything readable and intact.

## Install

**Chrome / Edge / Opera**
1. Download and unzip `font-size-global-step-scale.zip`
2. Go to `chrome://extensions` → enable **Developer mode**
3. **Load unpacked** → select the unzipped folder

**Firefox**
1. Go to `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on**
2. Select `manifest.json` in the unzipped folder

## Permissions

| Permission | Why |
|---|---|
| `tabs` | Read the active tab's hostname and get/set its zoom |
| `storage` | Store your per-site zoom preferences |

No network calls. Nothing leaves your device.

## Publishing notes

- MV3, no remote code, no data collection — store-safe.
- Chrome Web Store: single-purpose accessibility tool.
