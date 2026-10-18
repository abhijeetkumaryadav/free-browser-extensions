# Lottie Preview Studio v1.0.0

Preview Lottie JSON animations right in your browser — paste JSON or drop a `.json` file and get an instant offline render with transport controls and composition metadata.

## Features

- Paste Lottie JSON or drop a `.json` file
- Play / pause, frame scrubber, 0.5×–2× speed control, loop toggle
- Metadata panel: frames, FPS, duration, layer count, canvas size, Lottie version
- Copy JSON back to clipboard; last animation restored on reopen
- **100% offline** — the lottie-web renderer is bundled locally inside the extension (no CDN at runtime)

## Permissions

| Permission | Why |
|---|---|
| `storage` | Remembers the last loaded animation on this device |
| `clipboardWrite` | "Copy JSON" button |

No host permissions. Nothing is ever sent anywhere — the animation JSON stays on your device.

## Install

**Chrome / Edge:** unzip → `chrome://extensions` (or `edge://extensions`) → enable Developer mode → **Load unpacked** → select the folder.

**Firefox:** unzip → `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → select `manifest.json`.

**Opera:** unzip → `opera://extensions` → enable Developer mode → **Load unpacked**.

## Publishing notes

- Manifest V3, no deprecated APIs.
- The bundled `lottie.min.js` is the official lottie-web player (v5.12.2) shipped inside the package — no remote code is loaded at runtime.
- No data collection, no network calls at all.
