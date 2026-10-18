# Subtitle Editor — Canvas Preview

Edit SRT subtitle files locally: change cue text and timings, preview the result
on a canvas, and download the edited SRT.

## How it works

1. Open an `.srt` file or paste SRT text.
2. Each cue shows editable start/end timestamps (SRT format) and editable text.
3. Scrub the timeline — the canvas renders whichever cue is active at that time,
   with adjustable font size, text color, and background box.
4. Add new cues or delete cues as needed.
5. Click **Download SRT** to save the edited file.

## Honest scope

- Edits your SRT files only — it does not burn subtitles into video.
- The canvas preview is a text mockup, not a video player.
- 100% local: files never leave your machine. No network calls.

## Permissions

- `storage` — reserved for future preference persistence.
