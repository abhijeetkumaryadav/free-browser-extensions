# Page Number Styler

Load local image files, stamp styled page numbers on them, reorder pages, and
download the numbered set.

**Honest scope:** images only — not PDF pages. Numbering is drawn onto copies
of your images; your originals are never modified. Downloads save as individual
numbered PNGs (`page-001.png`, `page-002.png`, …). Everything runs locally; no
network calls, nothing uploaded.

## Features
- Add up to 60 images (15 MB each)
- Styled page numbers: position (6 spots), size, margin, colors, pill toggle
- Formats: plain `1`, `– 1 –`, `Page 1`, `Page 1 of 8`; custom start number
- Reorder with ↑/↓, per-page preview of its label
- Live preview of page 1 with its stamp
- Style options persist in chrome.storage.local

## Headless engine tests
The layout engine (`formatLabel`, `stampBox`, `fitBox`, `pageNumbers` between
`// ENGINE-START`/`// ENGINE-END`) was tested headless: all 4 label formats,
stamp boxes for all 6 positions (bounds + font math + clamping), fit-box
scaling incl. never-upscale and zero guards, page-number clamping incl.
invalid/negative starts.
