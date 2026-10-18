# FractalForge — Procedural Fractal Art

A fractal art toy in your browser toolbar. Generate **Mandelbrot**, **Julia set**, and **Barnsley-style fern** fractals on canvas, shuffle for fresh random pieces, pick palettes, zoom into the Mandelbrot set, and download any artwork as a PNG.

**Everything is computed on-device.** No network calls, no data collection. Just a fun toy.

## Features
- 3 fractal modes: Mandelbrot (click to zoom 2×, Shift+click to zoom out), Julia sets, jittered fern IFS
- "Surprise me" generates a brand-new random piece (new Julia constant, new Mandelbrot viewpoint, new fern coefficients, random palette)
- 5 smooth color palettes (Sunset, Ocean, Neon, Ember, Mono) with log-smoothed iteration coloring
- Detail slider (iteration count 60–400)
- Chunked row-by-row rendering with progress bar — the popup stays responsive
- One-click PNG download (640×640) via blob anchor — no `downloads` permission needed
- View + preferences persist locally

## Install (Chrome / Edge / Opera)
1. Unzip `procedural-fractal-art-generator-canvas.zip`.
2. Open `chrome://extensions`, enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

## Install (Firefox)
1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on** and choose `manifest.json`.

## Permissions
- `storage` — remembers your fractal view, palette, and detail setting. That's it. No host permissions, no network, no content scripts.

## Publishing notes
- MV3, no remote code, zero network traffic — should pass store review cleanly.
- Not tested in a live browser beyond syntax/manifest validation; please render a piece and download a PNG before publishing.
