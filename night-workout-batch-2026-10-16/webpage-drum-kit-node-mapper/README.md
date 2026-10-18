# Page Drum Kit — Node Mapper

Harmless visual/audio toy. Turns visible page elements into clickable drum pads
on a canvas-style overlay and plays **locally synthesized drum sounds** (Web
Audio API — no audio files, no network, 100% local).

## What it does

- **Start drum kit** — maps up to 24 visible elements as glowing drum pads
  (Kick, Snare, Hat, Toms, Clap, Cymbal, Sub Kick)
- Click/tap a pad → its synthesized drum voice plays and the pad flashes
- Volume and pad-count sliders, persisted between sessions
- **Stop & clear** (or `Esc`) removes every trace

## Honest scope

- **Toy only.** The real page DOM is never modified — pads are overlay clones.
- User-triggered only; nothing happens until you click Start.
- Fully reversible: one click removes the overlay completely.
- Sounds generated locally in your browser; zero telemetry.

## Files

`manifest.json`, `popup.html`, `popup.css`, `popup.js`, `content.js`, `README.md`,
`icons/icon{16,48,128}.png`.
