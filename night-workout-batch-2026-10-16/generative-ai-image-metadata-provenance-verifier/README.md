# Image Provenance Edu

A **local image metadata reader** plus an **explainer of provenance concepts** and a personal notes log.

## Honest scope (please read)

**Reads basic file info — NOT provenance verification.** For any image you choose locally, the popup shows only:

- file name, MIME type, byte size,
- pixel dimensions, last-modified date.

It does **not** parse EXIF fields, does **not** verify C2PA manifests or signatures, does **not** detect watermarks or AI-generated content, and uploads nothing anywhere. The bundled "Provenance concepts" section explains what EXIF, C2PA/Content Credentials, and generative-AI watermarks are — and why basic file info is never proof of origin.

## Permissions

- `storage` — saves your notes locally.

## Files

- `manifest.json`, `popup.html`, `popup.css`, `popup.js`, `README.md`, `icons/icon{16,48,128}.png`

Version 1.0.0 · Manifest V3 · fully local, zero network.
