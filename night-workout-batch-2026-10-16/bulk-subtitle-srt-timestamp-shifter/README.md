# SRT Shift — Bulk Subtitle Timestamp Shifter

Fix out-of-sync subtitles in seconds. Upload or paste SRT files, pick a ± offset
(seconds + milliseconds), preview the shifted cues, and download the result.

## How to use

1. Click the toolbar icon.
2. Add SRT files (file picker, multiple allowed) or paste SRT text directly.
3. Set the shift offset: `+`/`−` direction, seconds and milliseconds.
4. Press **Shift timestamps** — every cue timestamp moves by the offset.
   Timestamps clamp at `00:00:00,000` (never go negative).
5. Preview the first cues per file, then download each file (or all at once)
   as `*_shifted.srt`.

## Honest scope

- Shifts SRT timestamps only. It cannot fix OCR errors, overlapping cues, or
  timing drift that changes over the file.
- **Your files, local only** — nothing is uploaded or sent anywhere. The
  extension requests no permissions at all.

## Technical notes

- Manifest V3, zero permissions, single-file popup (no content script).
- Robust line parser: malformed timestamp lines are left untouched.
- Built with Manifest V3 for Chrome / Edge; compatible with Firefox and Opera.
