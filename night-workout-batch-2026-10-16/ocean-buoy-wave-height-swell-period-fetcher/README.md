# Wave Watcher — Sea State Guide & Observation Log

A wave-physics explainer plus a personal observation log: what significant wave height,
period, and direction mean; swell vs wind waves; a simplified sea-state band table;
and a logbook for observations you make yourself.

**Educational only — not live buoy data.** No data is fetched and nothing is
transmitted. Everything is local: the guide content is bundled, and your log lives
in `chrome.storage.local`.

## Features
- Plain-language guide to wave height, period, direction, swell vs wind waves
- Sea-state bands (Calm → Very high) with per-observation band badges
- Observation log: height, period, direction, note; stats (count, max); delete

## Files
- `manifest.json` — MV3 manifest
- `popup.html` / `popup.css` / `popup.js` — UI + sea-state engine (between `// ENGINE-START` and `// ENGINE-END`)
- `icons/` — generated 16/48/128 PNG icons

## Install (developer mode)
1. Open `chrome://extensions` (or `edge://extensions`)
2. Enable Developer mode
3. "Load unpacked" → select this folder
