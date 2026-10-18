# AI Watermark Detective

**Inspect images for AI-generator hints** — a heuristic helper, not a forensic tool.

## What it does
- **Drop an image** (PNG / JPEG / WebP) and it scans embedded metadata for AI-generator markers:
  - PNG text chunks (`tEXt`, `iTXt`, `zTXt`) and JPEG APP/COM segments (incl. XMP-style fields, Photoshop data, C2PA/JUMBF markers)
  - Known generator keywords (Midjourney, DALL-E, Stable Diffusion, Firefly, Ideogram, Leonardo, Imagen, …)
  - Filename hints (weak signal, clearly labeled as such)
- **Visual watermark checker**: zoom up to 4× and switch between Color / Grayscale / Edge-contrast / Negative views — faint corner watermarks and diagonal AI-watermark patterns are easier to spot this way
- **0–100 hint score** with a verdict card, plus **Copy report** for notes

## Honest limits
- Heuristics only. Absence of hints does **not** prove an image is human-made; presence of hints is not forensic proof.
- Stripped metadata (common on social platforms) means nothing to scan.
- All parsing happens on-device via `FileReader`. Nothing is uploaded anywhere.

## Install (Chrome / Edge / Opera)
1. Download and unzip `ai-generated-image-watermark-detector.zip`
2. Open `chrome://extensions`, enable **Developer mode**
3. Click **Load unpacked** and select the unzipped folder

## Firefox
1. Open `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on**
2. Select `manifest.json` inside the folder

## Permissions
| Permission | Why |
|---|---|
| `storage` | Reserved for future preference persistence (no data currently stored) |

No host access, no network calls, no content scripts.

## Privacy
Your image never leaves your device. Analysis runs entirely in the popup.

## Publishing notes
- Category: Developer Tools / Utilities
- Justification for review: `storage` is the only permission; all file parsing is local and user-initiated.
- Screenshots should show the verdict card and visual checker tab.

## Version history
- **1.0.0** — Initial release: metadata hint scanner, visual watermark checker, copyable report.
