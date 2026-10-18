# Aspect Crop Studio — Video Aspect Cropper

Crop any **local video file** to 16:9, 9:16, 1:1, or 4:5 with a draggable
crop box, then export a cropped WebM. Everything runs offline in the popup:
no servers, no uploads, no accounts.

## Honest scope

- **"Smart" = largest centered crop** of the target aspect, which you then
  drag and resize. No AI, no subject detection.
- Export is **video only** — `canvas.captureStream()` carries no audio
  track, so the output WebM is silent.
- The file is **re-encoded** with your browser's MediaRecorder codecs
  (VP9/VP8 WebM); quality depends on the browser. Export runs in real time
  (a 10 s clip takes ~10 s to export).
- Output resolution = your crop region, long side capped at 1920 px.

## Usage

1. Click the extension icon → drop a video (or click to choose one).
2. Pick an aspect ratio (default 9:16). The amber box starts centered at
   the largest fitting size.
3. **Drag the box** to reposition it; use the **Crop size** slider to
   shrink it.
4. **Play preview** checks the framing; **Export cropped WebM** renders
   the clip; click **Download WebM** to save it.
5. **New video** resets for another file.

## How it works

- `popup.js` draws the video frame to a preview `<canvas>` and overlays
  the crop rectangle (pointer-drag moves it; the slider zooms it).
- Export creates a second canvas sized to the crop region, plays the video
  from the start, paints the cropped region every animation frame, and
  records the canvas stream with `MediaRecorder`.

## Permissions

None. The extension reads only the file you choose and needs no
browser permissions at all.

## Files

- `manifest.json` — MV3 manifest (zero permissions)
- `popup.html` / `popup.css` / `popup.js` — 380px glassmorphism UI + crop logic
- `icons/` — generated 16/48/128 PNG icons
- `README.md` — this file

## Compatibility

Chrome and Edge (MV3 + `canvas.captureStream` + MediaRecorder).
Not tested in a live browser — manifest, syntax, and packaging validated.
