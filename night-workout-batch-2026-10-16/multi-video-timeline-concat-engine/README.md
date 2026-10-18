# Video Joiner — Multi-Video Timeline

Join multiple video files into one, entirely in your browser. Add clips, reorder
them on a simple timeline, and export a single joined WebM.

## How it works

1. Drop video files (or click to browse) — they appear on the numbered timeline.
2. Reorder with ▲/▼, remove with ✕.
3. Pick an output format (WebM VP9 / VP8 / default).
4. Click **Join videos** — each clip plays through a canvas in order while
   `MediaRecorder` re-encodes the sequence, with audio routed through a local
   `AudioContext` so sound is preserved.
5. Download the joined `.webm`.

## Honest scope

- **Re-encodes in real time** — a 3-minute timeline takes ~3 minutes to join.
- Output quality and codec support depend on your browser's MediaRecorder.
- Clips are letterboxed (black bars) into the largest clip's resolution.
- 100% local: files never leave your machine. No network calls.

## Permissions

- `storage` — remembers your format choice only.
