# Voice Inflection Visualizer

Live voice inflection visualizer: microphone capture through the Web Audio API, a live waveform, a pitch estimate (normalized autocorrelation over 50–1000 Hz), an RMS energy meter, and persistent session pitch-range statistics (min / max / average / sample count).

## ⚠️ Honest scope

**Measures pitch and energy only — NOT emotion analysis.** No speech recognition, no sentiment detection, no AI. Everything is computed locally with classic signal-processing techniques.

## Privacy

- The microphone is requested only when you click **Start mic** (a user gesture is required).
- No audio is recorded, stored, or uploaded. The stream feeds an analyser node only — nothing is routed to speakers.
- Only aggregate pitch statistics (min/max/sum/count) persist in `chrome.storage.local`; clear them anytime.
- Microphone denial is handled gracefully with a clear message.

## Usage

1. Click **Start mic** and allow microphone access.
2. Speak: watch the waveform, pitch (Hz), and energy (dB) update live.
3. Session pitch range accumulates; **Clear stats** resets it.
4. **Stop** releases the microphone.

## Files

- `manifest.json` — Manifest V3 (`storage` permission only)
- `popup.html` / `popup.css` / `popup.js` — UI and signal processing
- `icons/` — generated PNG icons

## Build

Icons were generated with Python PIL. No build step, no network calls, no dependencies.
