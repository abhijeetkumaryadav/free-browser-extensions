# ArcSmith — Narrative Arc Graph Builder

A creative planning tool for storytellers. Define projects (videos, episodes,
series), break each into beats with a phase (Setup / Rising action / Climax /
Falling action / Resolution) and a tension level (0–10), and ArcSmith renders
the narrative arc as a smooth tension graph. Compare up to 3 projects'
overlaid arcs, read per-project stats (beat count, peak tension, average
tension, climax position), and export everything as JSON.

## Honest scope

- **Creative planning tool.** Every beat, phase, and tension level is entered by
  you — the extension draws exactly what you describe. It generates nothing.
- **Not analysis, not AI.** It cannot judge story quality or predict audience
  response; the graphs visualize your own plan.
- **100% local.** Projects live in `chrome.storage.local`. No accounts, no
  network calls, nothing leaves the device.

## How to use

1. Add a project, select it, then add beats: title, phase, tension slider.
2. The **Arc graph** updates live; stats summarize the arc shape.
3. Tick up to 3 projects under **Compare projects** to overlay their arcs.
4. **Export JSON** to back up your plans; **Delete project** removes one.

## Files

| File | Purpose |
|---|---|
| `manifest.json` | MV3 manifest (`storage` only) |
| `popup.html` / `popup.css` / `popup.js` | Popup UI, glassmorphism styling, graph + compare logic |
| `icons/` | Generated PNG icons (16/48/128) |

## Permissions

- `storage` — save your projects and beats locally. That is the only
  permission; no page access, no network.

## Build & validation

- `node --check` passes on `popup.js`.
- `manifest.json` parses and targets Manifest V3.
- Icons generated locally with Pillow at exact 16/48/128 sizes.
- Not yet tested in a live browser; packaged as a development build.
