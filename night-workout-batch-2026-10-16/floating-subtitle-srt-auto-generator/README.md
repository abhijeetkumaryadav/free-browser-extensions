# SRT Subtitle Editor

A **manual** subtitle editor: type cues with timestamps, reorder and edit them,
then export a valid `.srt` file.

## Honest scope

- **Manual editor only.** This extension has no speech recognition and
  **cannot auto-generate subtitles from audio**. Every cue is typed by you.
- **Valid .srt output.** Export produces numbered cues with
  `HH:MM:SS,mmm --> HH:MM:SS,mmm` timestamps.
- **100% local.** Cues persist in `chrome.storage.local`. No network calls.

## Features

- Add cues with start/end timestamps (`HH:MM:SS,mmm`, `MM:SS,mmm`, `SS,mmm`, or plain seconds)
- Validation: bad timestamps, end-before-start, and empty text are rejected with a message
- Edit any cue, delete any cue, nudge cues up/down
- Auto-sort by start time in the list and the export
- Export to `subtitles.srt` via download; Clear-all with confirm

## Files

- `manifest.json` — Manifest V3
- `popup.html` / `popup.css` / `popup.js` — editor UI
- `srt.js` — dependency-free timestamp/SRT logic (unit-tested)
- `icons/` — generated PNG icons
