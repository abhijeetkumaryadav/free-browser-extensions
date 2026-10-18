# Canvas Poisoning Protector — v1.0.0

Defeats canvas fingerprinting by injecting invisible random noise (±2 on sampled pixels) into canvas readback (`getImageData`, `toDataURL`, `toBlob`, WebGL `readPixels`). Your pages render pixel-perfect; trackers get an unstable fingerprint that changes every read.

## Features
- MAIN-world injection at `document_start` — patches canvas prototypes before page scripts or trackers run
- Global on/off switch + per-site allowlist (pages never break silently — disable per site)
- Live per-tab status ("Protected / Not protected")
- Fingerprint demo: simulated runs showing hashes differ with the same noise algorithm
- All settings sync via `chrome.storage.sync`; everything stays on-device

## Install
**Chrome / Edge:** unzip → `chrome://extensions` (or `edge://extensions`) → Developer mode → Load unpacked → select this folder.
**Firefox:** `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → select `manifest.json`. (Note: the MAIN-world probe caveat — `world: "MAIN"` content scripts are Chromium-only; on Firefox the injector falls back gracefully and protection may not apply. The popup still manages settings.)

## Permissions (justified)
- `storage` — persist the master switch and per-site allowlist
- `activeTab` — read the current tab's hostname to show per-site status and to add/remove it from the allowlist

No network access. No data leaves your device.

## Publishing notes
- MV3, no remote code, no deprecated APIs
- No broad host permissions beyond content-script matches on http/https (required for the protection itself)
- Firefox: declare `world: MAIN` limitation in the listing description; consider the Firefox build optional
