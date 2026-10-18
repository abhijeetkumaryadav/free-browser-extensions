# Cadence Profiler — Speech Rate from Captions

Profiles speech rate (words-per-minute) over time from **captions the page exposes**, drawn as a canvas cadence graph with fast/slow stretch highlights.

## ⚠️ Honest scope

- **Caption-timing only.** Not audio analysis, not speech recognition. Empty results mean "no captions found", not "no speech".
- Captions with timestamps (text tracks, timed-text elements) give accurate WPM; captions without timestamps are spread evenly across the video duration as an estimate.

## How it works

1. Open a video page and click **Analyze captions on this page** (content script injects on click only).
2. Popup computes WPM in ~15s windows, draws the graph, and lists notable fast (>170 WPM) / slow (<120 WPM) stretches against conversational reference bands.

## Permissions

- `activeTab` + `scripting` — read caption text/timing from the active tab on click only.
- `storage` — reserved for future prefs.

## Install

1. Go to `chrome://extensions`, enable **Developer mode**.
2. **Load unpacked** → select this folder (or install the `.zip`).

## Development

`node --check popup.js content.js` passes. No dependencies.
