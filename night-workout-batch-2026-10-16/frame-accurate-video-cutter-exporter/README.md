# Frame-Accurate Video Cutter

Cut a video at exact frames: step frame-by-frame, set IN/OUT points, preview, export.

## What it does

- Upload a video file (MP4/WebM/MOV — whatever your browser can play).
- Step **±1 or ±10 frames** (frame step uses the fps you set, default 30).
- Set **IN** and **OUT** cut points, scrub the timeline, preview the clip looping in place.
- **Export clip** re-encodes the chosen range via `canvas.captureStream` + MediaRecorder → downloads a `.webm`.

## Honest scope

- Cuts at your chosen frames via **re-encode** — this is **not** lossless keyframe cutting. Quality depends on browser codecs; export runs in real time.
- Audio is not carried through the canvas pipeline — exported clips are video-only.
- 100% local. Zero network calls.

## Install

1. Open `chrome://extensions`, enable **Developer mode**.
2. **Load unpacked** → select this folder.
3. Click the toolbar icon to open the cutter.
