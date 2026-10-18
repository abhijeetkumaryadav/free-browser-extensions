# FITS Frame Previewer — Educational Demo

An **educational demo** showing how astronomers stretch FITS frames: a synthetic
"FITS-like" test frame rendered on canvas, with black/white cut levels and
linear / log / sqrt stretch modes.

## What it is / is not

- ✅ Renders a **synthetic** test frame (seeded PRNG: gradient + nebula blobs + stars + read noise).
- ✅ Min/max cut sliders and linear/log/sqrt stretch modes — exactly the controls used on real data.
- ✅ Quick guide to real FITS concepts: HDU blocks, BITPIX, BZERO/BSCALE, stretching.
- ❌ **Not a real FITS parser.** It cannot open .fits/.fts files and reads nothing from disk.

## How to use

1. Open the popup — a frame is generated automatically.
2. Drag **Black level** and **White level** to set cut levels.
3. Switch **Linear / Log / Sqrt** to see how stretches reveal faint signal.
4. **Regenerate frame** rolls a new seeded test frame.

## Privacy

Fully local. No network, no permissions.

## Tech

Manifest V3, canvas rendering, no dependencies. Engine functions (`mulberry32`,
`genFrame`, `stretchValue`) live between `// ENGINE-START` / `// ENGINE-END`
and are headless-testable.
