# Spatial Viewport Grid — Viewport Canvas Mesh

One click injects a **canvas grid + rulers + breakpoint markers** over the active
tab for responsive-design spatial analysis. Toggle again to remove; the page DOM
is never modified.

**Honest scope:** this is a grid overlay. It is **not AR** — no spatial/AR API
exists for browser extensions, and this extension does not claim one.

## Features

- 20px minor / 100px major canvas grid with px rulers and live viewport readout
- Breakpoint markers (Mobile S 360, Tablet 768, Laptop 1024, Desktop 1440) —
  green where the viewport fits, pink where it doesn't
- Redraw button (toggle off/on) and current viewport size panel
- Fully local, zero network

## Permissions

- `storage` — remember overlay state
- `activeTab` + `scripting` — inject the overlay on click only
