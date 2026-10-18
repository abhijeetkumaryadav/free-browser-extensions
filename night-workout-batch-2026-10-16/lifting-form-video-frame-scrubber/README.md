# Form Frame Scrubber — Lifting Video Review

Frame-by-frame scrubber for reviewing lifting form from your own video files.
**Review aid only — not coaching advice.**

## What it does

- **Load a local video file** (never leaves the popup; no upload)
- **Frame-by-frame stepping** — ←/→ keys (Shift = 10 frames) or the Frame buttons,
  with an adjustable FPS value for exact frame duration
- **Slow-motion playback** — 1× / 0.5× / 0.25× / 0.1×
- **A/B loop** — mark two points (or press M) and loop a single rep endlessly
- Seek bar, mm:ss.cc timestamps, FPS/speed settings remembered locally

## Honest scope

- Plays back your files for visual review. It does not analyze form,
  count reps, or give coaching advice.
- Video stays in your browser; nothing is recorded or uploaded.

## Install (developer mode)

1. Open `chrome://extensions`, enable **Developer mode**
2. **Load unpacked** → select this folder
3. Pin the extension and click the icon to open the scrubber

## Files

| File | Purpose |
|---|---|
| `manifest.json` | MV3 manifest |
| `popup.html` / `popup.css` / `popup.js` | UI + frame engine |
| `icons/` | 16/48/128 PNG icons |

v1.0.0 · MIT
