# Clip Duration — Social Format Cutter

Trim uploaded videos to social-format lengths. **Trims to length — does not
reframe content.**

## What it does
- Drop in or choose a video file (preview in the popup).
- Set a start/end range with sliders, or snap to social presets: **15s / 30s / 60s / 90s**.
- Preview the chosen clip in place.
- Export via MediaRecorder (`captureStream`), download as `.webm`.

## Honest scope
- Trims only — no cropping, reframing, or aspect-ratio changes.
- Re-encodes via MediaRecorder in real time; quality and codec support depend
  on the browser (VP9 WebM preferred, WebM fallback).
- Audio is captured from the playing video; export runs in real time.

## Privacy
100% local. Your video never leaves the machine. Zero network.

## Build
Manifest V3, `storage` permission only (remembers nothing sensitive).
