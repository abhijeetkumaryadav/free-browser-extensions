# QRScan — QR Code Scanner & Decoder (v1.0.0)

Decode QR codes from an uploaded image or straight from your clipboard — 100% on your device, zero network.

## Features

- **Drop / browse / paste**: drag an image into the dropzone, pick a file, or press **Paste from clipboard** to scan a copied image.
- **Local decoding** via the vendored jsQR library (Apache-2.0, bundled in `lib/` — no remote code, MV3-compliant).
- Decoded text shown in a monospaced result box with **Copy text** and an **Open link** button (only appears for `http(s)` URLs).
- Image preview with dimensions; rescan button.
- Remembers the last successful decode locally (`chrome.storage.local`).

## Honest scope

- Decodes **QR codes only**. It does **not** decode UPC, EAN, CODE-128, or other 1D barcodes.
- The clipboard is read **only** when you explicitly press the "Paste image from clipboard" button — never silently in the background.
- Everything runs on-device: no uploads, no servers, no network calls at all.

## Permissions — why each one

| Permission | Why |
|---|---|
| `storage` | Remembers the last decoded payload locally. |
| `clipboardRead` | Lets the popup read an **image** from the clipboard when you press the Paste button. |

No host permissions, no content scripts, no remote code.

## Install (Chrome / Edge / Opera)

1. Unzip `barcode-qr-code-scanner-decoder.zip`.
2. Go to `chrome://extensions` (or `edge://extensions`, `opera://extensions`).
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the unzipped folder.

## Install (Firefox)

Firefox supports Manifest V3 extensions from files via `about:debugging` → "This Firefox" → "Load Temporary Add-on". `clipboardRead` maps to Firefox's `clipboardRead` permission; the image-paste button is Chrome/Edge-tested — file upload works everywhere.

## Publishing notes

- No privacy-policy red flags: zero network usage, honest single-purpose description.
- Bundled `lib/jsQR.js` is Apache-2.0 (attribution kept in the file header).
- Screenshots: show dropzone, a decoded QR result, and the copy button.
