# Deepfake Red-Flag Guide

A video-forgery **red-flag guide** (blending edges, lighting, frame flicker, blinking, lip-sync, hair glitches, head-body inconsistency, audio artifacts) plus a **personal verification-notes log** — save what you checked and what you concluded.

## Honest scope (please read)

**Educational only — NOT a detection tool.** This extension:

- **does not analyze any video** — no frames are loaded, no pixels are measured, no "subpixel frequency analysis" happens;
- **does not upload or transmit anything** — everything is in `chrome.storage.local`;
- ships a **bundled reference list** of red flags described by researchers, which you apply with your own eyes and judgment.

If you need real forgery analysis, consult qualified forensic tools or professionals. Nothing here certifies a video as real or fake.

## Permissions

- `storage` — saves your notes locally.

## Files

- `manifest.json`, `popup.html`, `popup.css`, `popup.js`, `README.md`, `icons/icon{16,48,128}.png`

Version 1.0.0 · Manifest V3 · fully local, zero network.
