# Frame-by-Frame GIF Converter

Turn a video clip into an animated GIF, frame by frame, entirely on your device.

## What it does

1. **Upload a video** — drag & drop or click to choose (MP4/WebM work best).
2. **Scrub frame by frame** — drag the timeline or step ±1 frame with the ◀ ▶ buttons.
3. **Pick a range** — start/end seconds, frames-per-second, and output width.
4. **Convert** — the extension captures each frame to a canvas, quantizes it to a
   256-color palette, and encodes an animated GIF with a tiny bundled LZW encoder.
5. **Download** the resulting `.gif`.

A **Play preview** button loops your chosen range in-place before you commit.

## Honest scope

- **Simple local encoder on purpose.** The GIF writer is ~60 lines of bundled code:
  fixed 3-3-2-bit (256 color) palette, no dithering, no remote libraries, no servers.
  Expect posterized colors on gradients — fine for memes, short clips, and UI demos.
- **Short clips only.** Defaults (2 s at 8 fps) stay snappy; the extension caps work
  at 600 frames and 20 fps so your browser doesn't melt.
- **100% local, zero network.** Your video never leaves this machine.
- Nothing is uploaded, nothing is tracked. No permissions beyond `storage`.

## Files

- `manifest.json` — Manifest V3, `storage` permission only
- `popup.html` / `popup.css` / `popup.js` — UI, scrubbing, and the bundled GIF encoder
- `icons/` — 16/48/128 PNG icons
