# Signature Stamp Pad — Image Signer

Draw your own signature stamp, save named stamps, and place a stamp on a
local image (bottom-right, adjustable size), then download the signed PNG.
Fully local, zero network.

## Honest scope

- These are **your signature stamps** — a personal image-watermarking tool.
  This is **not a legal electronic signature** and provides no signing
  certificate or tamper-evidence.
- It does **not** work on PDF files — images only.
- Nothing is uploaded; stamps live in `chrome.storage.local`.

## Use

1. **Draw** — draw your signature, name it, save the stamp.
2. **Stamps** — see saved stamps, delete ones you no longer want.
3. **Place** — load a local image, pick a stamp, adjust its size, download
   the signed PNG.

## Files

- `manifest.json` — MV3 manifest, `storage` permission only
- `popup.html` / `popup.css` / `popup.js` — UI + stamp engine
- `icons/` — generated PNG icons

## Permissions

- `storage` — saves your stamps locally.
