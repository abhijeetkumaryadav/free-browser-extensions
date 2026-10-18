# Thumbnail Contrast Booster

A manual thumbnail editor. Upload an image, tune **contrast, exposure, saturation, and vibrance** with sliders, hold-to-compare against the original, and download as PNG, JPEG, or WebP. All processing is local canvas work — your image never leaves the machine.

## Honest scope

- **Manual sliders only.** There is no automatic "AI enhance", no auto-fix, no magic button. You move every slider yourself.
- **Vibrance** boosts saturation more in already-muted areas (a simple smart-saturation, computed locally) — it is still just math, not intelligence.
- JPEG/WebP exports are lossy; quality slider applies to those formats only.
- The original file is never modified — only the download is filtered.

## Permissions

- `storage` — remembers your last slider positions.

## Privacy

100% local. No network calls, no uploads, no telemetry.
