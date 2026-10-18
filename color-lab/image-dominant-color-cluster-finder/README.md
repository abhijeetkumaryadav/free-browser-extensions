# ColorMine — Image Dominant Colors v1.0.0

Upload any image and instantly see its dominant colors — sampled and ranked locally on your device.

## Features
- **Choose or drag & drop** an image (PNG · JPG · GIF · WebP)
- **Dominant color ranking** with percentage share per color
- **Click any swatch to copy** its HEX code; **Copy palette** exports the list
- Adjustable number of colors shown (3–12), remembered locally
- **Method (honest scope):** image is downsampled to a 64px canvas, pixels are grouped into 12-bit color buckets (4 bits/channel = 4096 buckets), top buckets are averaged. This is a fast local approximation — not a full k-means clustering. Transparent pixels are ignored.

## Install (unpacked)
1. Unzip the release package so `manifest.json` is at the folder root.
2. Open `chrome://extensions` (Chrome/Edge) — or `about:debugging#/runtime/this-firefox` in Firefox.
3. Enable **Developer mode** → **Load unpacked** → select the folder.
4. Click the toolbar icon to open ColorMine.

## Permissions justification
- `storage` — remembers your "colors to show" preference. Nothing else. Your images never leave the device.

## Publishing notes
- Manifest V3, no remote code, no network requests, no analytics.
- Firefox-compatible (uses standard WebExtensions APIs only).

## Honest scope
- Local canvas sampling only. It does not upload, scan, or inspect web pages.
