# Helium Shifter — Offline Pitch & Speed

An offline pitch/speed shifter for audio files. Upload a file, nudge pitch (±12 semitones) and speed (0.5–2×), preview the classic "helium" effect, and export a 16-bit WAV.

## Honest scope

- **Offline file processing only.** This extension has **no real-time capability**: no microphone capture, no live voice changing. It processes a file you upload through `OfflineAudioContext`.
- The effect is resampling-based (playback rate change), which shifts pitch *and* duration together — the classic chipmunk/helium sound.
- 100% local. No network calls, no telemetry. Your file never leaves the machine.

## Use

1. Click the dashed drop area and choose an audio file.
2. Drag **Pitch shift** (−12…+12 semitones) and **Speed** (0.5…2×).
3. **Preview** to hear it; **Stop** to end preview.
4. **Render & download WAV** bakes the effect into a 16-bit PCM WAV at the source sample rate.

## Technical notes

- Rendering length = `source length / (speed × pitchRate)`.
- WAV encoder is a minimal hand-rolled 16-bit PCM writer (no libraries).
- Permissions: none requested.

## Files

| File | Purpose |
|---|---|
| `manifest.json` | MV3 manifest, popup action only |
| `popup.html` / `popup.css` / `popup.js` | UI + decode/preview/render logic |
| `icons/` | Generated 16/48/128 PNG icons |
