# Caption Styler — System-Font Video Captions

Style video captions using **fonts already installed on your device**, preview them live, and export a WebM with captions burned in. Fully local — nothing is uploaded, and no fonts are downloaded.

## How to use

1. **Media** — upload a video, then either upload an `.srt` file, paste SRT text, or type a caption to preview.
2. **Style** — pick from fonts detected on *your* device, set size, text/background colors, background box, and top/center/bottom position. Choices persist.
3. **Preview & export** — hit *Live caption preview* while the video plays, then *Burn in & export WebM*.

## Honest scope

- **System fonts only.** The font list is probed from fonts installed on your device — no downloads, no web fonts.
- **Video-only export.** Captions are burned in via canvas capture; the browser's `MediaRecorder` re-encodes the video and **audio is not carried through** canvas capture. Output is WebM.
- Quality and codec support depend on your browser's `MediaRecorder`.
- SRT parser handles standard `HH:MM:SS,mmm --> HH:MM:SS,mmm` cues and strips inline HTML tags.

## Permissions

- `storage` — remembers your caption style settings.

## Privacy

100% local. Your video, captions, and settings never leave the machine.
