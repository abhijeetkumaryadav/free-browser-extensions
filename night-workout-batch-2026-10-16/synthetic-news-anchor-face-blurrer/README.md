# Manual Redaction Tool — Pixelate Regions

**Manual redaction only — not face detection.** Load a local image, drag boxes over
the regions you want to hide, and download the redacted copy.

## How it works

1. Click **Load a local image** and pick an image file (never uploaded — it stays in
   your browser).
2. Drag on the image to mark regions (dashed boxes show while dragging).
3. Adjust **Pixel size** to control how coarse the mosaic is.
4. Click **Pixelate & download** — the redaction is applied at full image resolution
   and saved as `<name>-redacted.png`.
5. **Undo box** removes the last region; **Clear all** removes every region.

## Notes

- Nothing leaves your browser. No accounts, no servers, no telemetry.
- This tool cannot find faces — you draw every box yourself.
- The working canvas is scaled to fit the popup; the download uses the image's
  full natural resolution.
