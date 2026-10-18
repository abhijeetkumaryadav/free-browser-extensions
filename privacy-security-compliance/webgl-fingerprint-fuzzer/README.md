# WebGL Fingerprint Fuzzer v1.0.0

Anti-fingerprinting shield for WebGL. Trackers fingerprint you by reading
back WebGL pixels (`readPixels`) and GPU identification strings
(`WEBGL_debug_renderer_info`). This extension poisons both:

- **Invisible pixel noise** — ±2 LSB sprinkled sparsely over `readPixels`
  output (WebGL1 + WebGL2). Rendering looks pixel-perfect to your eyes;
  tracker hashes come out different every load.
- **GPU string spoofing** — `UNMASKED_VENDOR_WEBGL` / `UNMASKED_RENDERER_WEBGL`
  return generic values with a per-page-load random token, so the
  fingerprint is unstable across loads and sites.

## Features

- Master on/off toggle.
- **Per-site protection toggle** — exclude a 3D app that misbehaves;
  allowlist managed in the popup (applies on next page load).
- Live status pill: Protected / Site excluded / Disabled.
- Everything stored on-device; nothing transmitted.

## Install

**Chrome / Edge**
1. Unzip `webgl-fingerprint-fuzzer.zip`.
2. Open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

**Firefox**
1. Open `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on**.
2. Select the `manifest.json` inside the unzipped folder.

## Permissions — justified

| Permission | Why |
|---|---|
| `storage` | Master toggle + per-site allowlist, on-device. |
| `activeTab` | Reads the current tab's hostname for the per-site toggle. |
| Content script on `http(s)` at `document_start` | Injects the fuzzing wrappers before page scripts run. Never reads page content, credentials, or keystrokes. |

## How it works (honest notes)

- The isolated content script reads settings, then injects a **static,
  extension-shipped** script string into the page's main world via a script
  tag. This works in Chromium and Firefox (unlike `world: "MAIN"` scripts,
  which are Chromium-only). No remote code, ever.
- Protection activates per page load; if anything fails, the page simply
  loads unmodified (fail-closed).
- Fingerprinting via other vectors (canvas 2D, fonts, audio) is out of scope —
  pair with Canvas Poisoning Protector for broader coverage.

## Publishing notes

- Manifest V3, no network requests, no remote code — store-friendly.
- Some aggressive anti-bot pages may detect the wrappers; the per-site
  allowlist is the supported escape hatch.
