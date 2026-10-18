# Deep-Sky Histogram Equalizer Demo

An educational demo of histogram equalization on a synthetic "deep-sky" test image — generated in your browser with a seeded random generator (dark gradient + nebula blobs + stars + noise).

- **Before / After** canvases with an adjustable equalization-strength slider
- **Overlaid histograms** showing how dark-tone signal gets stretched
- **Regenerate** a new test image; toggle stars on/off
- **Why-stack explainer** card: signal hides in the darkest 10% of the histogram; stacking beats down noise before stretching

**Honest scope:** Demo only — not real image processing. It cannot load, stack, or process your real photos.

## Install (developer mode)
1. `chrome://extensions` → enable Developer mode → Load unpacked → select this folder.
