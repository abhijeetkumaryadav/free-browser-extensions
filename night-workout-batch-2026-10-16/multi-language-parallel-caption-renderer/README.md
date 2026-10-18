# Parallel Captions — Dual Caption Viewer

A side-by-side caption viewer for two subtitle tracks you supply. Useful for
language learners: load an original-language `.srt`/`.vtt` file and your own
translated version, then play them in sync with an adjustable timing offset.

## What it does NOT do

**This extension does not machine-translate anything.** There is no
translation API inside extensions, so both tracks are files you provide
yourself. Alignment is by paragraph/cue order, not meaning — if one track has
extra paragraphs, the rows will drift. The offset slider helps you fix
timing drift between two tracks.

## Use

1. Click the upload button in the popup and load Track A and Track B
   (`.srt`, `.vtt`, or plain text — blank line = new paragraph).
2. Press play; both columns advance on the same virtual timeline.
3. Drag the "Track B offset" slider to compensate for timing differences.

Tracks you load are remembered locally (first 2000 cues) so you don't have to
re-upload them every time you open the popup.

## Privacy

Everything runs locally. No network requests, no analytics, no accounts.

## Files

- `manifest.json` — MV3 manifest (`storage` permission only)
- `popup.html` / `popup.css` / `popup.js` — viewer UI and SRT/VTT/plain-text parser
- `icons/` — generated PNG icons
