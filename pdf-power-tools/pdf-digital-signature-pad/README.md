# SignStamp — PDF Signature Pad v1.0.0

Draw or type a signature, save presets, and stamp the signature as an image onto
your own PDF files. 100% local — the PDF library (pdf-lib, MIT) is bundled in
`vendor/`, and nothing is ever uploaded.

> **Honest scope:** this is a drawn/typewritten **image stamp**, not a
> cryptographic digital signature. It does not certify document integrity,
> authenticity, or signer identity, and carries no legal-signature guarantees.

## Install

**Chrome / Edge**
1. Unzip the package.
2. Open `chrome://extensions`, enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

**Firefox**
1. Open `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on**.
2. Select `manifest.json` (temporary install; some APIs behave the same).

## Usage

1. **Signature tab** — draw with mouse/touch, or switch to *Type* and render your
   name in a script/serif/mono style. Click **Save signature** to store presets.
2. **Stamp PDF tab** — choose a PDF, enter pages (`all` or `1, 3`), click the
   schematic page preview to position the signature, set the width, pick the
   active signature, then **Stamp & download PDF**.

## Permissions

- `storage` — saves your signature presets locally. Nothing else.

## Files

- `popup.html` / `popup.css` / `popup.js` — UI and stamping logic.
- `vendor/pdf-lib.min.js` — pdf-lib 1.17.1 (MIT), bundled locally at build time
  via `curl` from unpkg. Loaded from disk, never from a CDN.
- `icons/` — PIL-generated PNG icons.

## Publishing notes

- MV3, no remote code, no host permissions, no network calls.
- Chrome Web Store: single-purpose "productivity" tool; disclose that
  signatures are image stamps, not cryptographic signatures.
