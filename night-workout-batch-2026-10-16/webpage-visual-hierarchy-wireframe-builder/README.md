# Wireframe Builder — Visual Hierarchy Overlay

See any page's visual hierarchy as a labeled wireframe. One click draws color-coded boxes over every visible block element — tag name plus width × height on each box:

- **Violet** — layout blocks (header, nav, main, section, div…)
- **Amber** — headings (h1–h6)
- **Emerald** — media (img, video, svg…)
- **Blue** — controls (button, links, inputs)

Toggle the button again to remove the overlay — the page DOM is never modified.

**Honest scope:** structural wireframe — sizes are approximate (viewport-relative, excludes scrolled-out content). Largest elements are drawn first, capped at your Max boxes setting.

## Options

- **Tag labels** — show/hide the tag + size labels
- **Text blocks** — include/exclude paragraphs, list items, etc.
- **Max boxes** — cap how many boxes are drawn (largest first)
