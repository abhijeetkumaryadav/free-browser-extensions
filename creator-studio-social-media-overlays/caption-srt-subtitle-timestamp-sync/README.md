# SRT Timestamp Studio v1.0.0

Edit SRT subtitles: paste or open a `.srt` file, validate it, shift all timestamps, fix numbering, preview, and export — 100% client-side.

## What it does

- **Parse & validate** — checks cue numbering, timestamp format (`HH:MM:SS,mmm`), start-before-end, overlaps, and empty text. Errors shown in red, warnings (overlaps, empty text, non-sequential numbering) in amber.
- **Shift timestamps** — apply ±seconds and ±milliseconds to every cue at once (e.g. fix audio that's 1.5s out of sync). Times never go below zero. Running total shown.
- **Fix numbering** — renumber cues 1…N with one click.
- **Reset** — restore the originally parsed subtitles.
- **Preview** — scrollable cue list with numbers, time ranges, and text.
- **Export** — download the corrected `.srt` or copy it to the clipboard.
- Remembers your last input on-device; includes a loadable sample.

## Install

**Chrome / Edge**
1. Unzip `caption-srt-subtitle-timestamp-sync.zip`.
2. Open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
3. **Load unpacked** → select the unzipped folder.

**Firefox**
1. Open `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → pick `manifest.json`. (Temporary until signed via AMO.)

**Opera**: same as Chrome via `opera://extensions`.

## Permissions

- `storage` — remembers your last pasted SRT locally. Justification: restore work between popup opens.
- `clipboardWrite` — "Copy" button. Justification: one-click copy of the corrected SRT.

No host permissions, no network calls. Subtitle text never leaves your device; the download is generated locally via a blob URL.

## Publishing notes

- MV3 only, no deprecated APIs.
- Privacy: 100% client-side; declare "no data collected" in store listings.
- Screenshots: show the validation panel and timestamp-shift controls.
