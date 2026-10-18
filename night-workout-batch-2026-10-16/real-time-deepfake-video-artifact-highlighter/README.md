# Artifact Lens — Video Compression Artifact Visualizer

## What it is
A popup tool that loads a **local video file** and visualizes **compression / blocking artifacts** in its frames via a lens canvas.

## How it works (heuristic, honest)
Each frame is sampled to a small canvas. Luminance gradients along 8×8 macroblock boundaries — where MPEG-style codecs concentrate blocking artifacts — are painted as pink "hot" pixels on the lens canvas. Sensitivity slider controls the detection threshold.

## What it is NOT
**This is NOT deepfake detection.** It cannot tell you whether a video is AI-generated. It only reveals where compression artifacts concentrate in a frame.

## Privacy
- Video never leaves the popup; all processing is local.
- Only sensitivity/overlay prefs are stored (`chrome.storage.local`).

## Permissions
- `storage` — persist sensitivity + live-overlay preference.

## Files
- `manifest.json`, `popup.html`, `popup.css`, `popup.js`
- `icons/icon16.png`, `icons/icon48.png`, `icons/icon128.png`
