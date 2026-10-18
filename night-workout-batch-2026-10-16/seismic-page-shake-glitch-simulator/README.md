# Seismic Page Shake — Glitch Simulator

Harmless visual toy. Shakes the active page with a seismic-style jitter (CSS
transforms driven by `requestAnimationFrame`), with an intensity slider.

## What it does

- **Start shaking** — user-triggered seismic jitter on the page
- Intensity slider 1–10, persisted between sessions
- **Stop & restore** (or `Esc`) ends the animation and restores the page exactly

## Honest scope

- **Toy only, visual CSS animation.** No page content is modified — only a
  transform on the root element while shaking, removed on stop.
- User-triggered only; nothing happens until you click Start.
- Fully reversible: one click restores the page exactly.
- 100% local, zero network, zero telemetry.

## Files

`manifest.json`, `popup.html`, `popup.css`, `popup.js`, `content.js`, `README.md`,
`icons/icon{16,48,128}.png`.
