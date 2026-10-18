# In-Browser Video Splitter

Client-side video clipper. **100% local — no uploads, no network.**

## What it does
1. Pick a video file from your device.
2. Set **start** and **end** points with the sliders (frame scrub preview).
3. **Preview clip** loops the segment.
4. **Record & export clip** plays the segment through a canvas `captureStream` into `MediaRecorder` and gives you a download link.

## Honest scope
- Exports **re-encode via MediaRecorder** — quality and exact format depend on your browser's codecs (WebM widely supported; MP4 only where the browser allows).
- Export runs in real time (a 30-second clip takes 30 seconds).

## Files
- `manifest.json` — MV3, permission: `storage` only
- `popup.html` / `popup.css` / `popup.js` — upload, range selection, canvas export
- `icons/` — generated PNG icons

## Privacy
Everything runs in the popup page. No network calls. Your video never leaves your machine.
