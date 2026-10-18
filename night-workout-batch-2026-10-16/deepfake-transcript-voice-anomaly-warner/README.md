# Deepfake Awareness — Voice Anomaly Guide

Educational deepfake-voice awareness guide for Chrome/Edge/Firefox/Opera (Manifest V3).

## What it does

- **Red-flag guide** — plain-language cards on what to listen for: unnatural cadence,
  audio artifacts, and source/provenance checks.
- **Interactive checklist** — a 10-item "clip I'm unsure about" checklist with a
  completion progress bar. Progress persists locally.
- **Verification notes log** — private notes on clips you have checked, with search,
  per-note delete, and clear-all. 200-entry cap.

## Honest scope

**Educational only — not detection.** This extension teaches what synthetic-voice
red flags sound like. It cannot detect deepfakes, cannot analyze audio, and a clean
checklist does not prove a clip is real. Always verify through independent sources
before sharing or acting on viral audio.

## Privacy

- Fully local. All checklist state and notes live in `chrome.storage.local`.
- Zero network calls. Nothing leaves the browser.

## Permissions

- `storage` — persist checklist progress and notes locally.

## Files

- `manifest.json`, `popup.html`, `popup.css`, `popup.js`
- `icons/icon{16,48,128}.png` (PIL-generated voice-wave glyph)
- `README.md`
