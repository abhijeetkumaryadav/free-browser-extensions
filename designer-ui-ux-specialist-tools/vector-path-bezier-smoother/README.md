# Vector Path Bezier Smoother

A standalone SVG path studio: paste SVG path data (`d` attribute), preview it on canvas next to the smoothed result, apply **Chaikin corner-cutting** smoothing with 0–5 adjustable iterations, and copy the smoothed path back out — with before/after point counts.

## Install

**Chrome / Edge**
1. Unzip `vector-path-bezier-smoother.zip`
2. Go to `chrome://extensions` (or `edge://extensions`), enable **Developer mode**
3. Click **Load unpacked** and select the unzipped folder

**Firefox**
1. Go to `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on** and pick `manifest.json`

## Usage
1. Click the toolbar icon, paste path data (or hit **Load sample**)
2. Drag the **Smoothing iterations** slider (0–5)
3. Compare original (gray) vs smoothed (pink) in the preview
4. **Copy smoothed path** — the output is a polyline `M…L…` path with coordinates rounded to 2 decimals

Supported commands: `M L H V C S Q T Z` (absolute + relative). Curves are sampled into polylines before smoothing; endpoints are always preserved.

## Permissions
- `clipboardWrite` — copy the smoothed path to your clipboard

No page access, no network requests, nothing stored. 100% client-side.

## Publishing notes
MV3, no deprecated APIs. Minimal justified permissions. Pure utility tool — straightforward store review.
