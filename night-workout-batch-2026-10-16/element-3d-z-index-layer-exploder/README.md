# 3D Layer Exploder

A harmless visual toy: tilt the current page's elements into an exploded 3D layer view.

## What it does
- Click **Explode 3D view** in the popup (explicit click only).
- The extension builds an overlay of simplified **clones** of the page's visible
  elements, each tinted and labeled with its tag name and z-index, fanned out in
  3D with CSS transforms.
- Drag to spin, adjust tilt angle and layer spread, toggle auto-rotate.
- **Restore page** (or press `Esc`) removes the overlay completely.

## Honest scope
- The real page DOM is **never modified** — only clones on an overlay layer.
- 100% local, zero network. No data leaves the browser.
- Labels and layer ordering are best-effort heuristics for fun, not a precise
  stacking-context analysis.

## Permissions
- `storage` — remember your tilt/spread/spin preferences.
- `activeTab` + `scripting` — inject the visual toy into the current tab only
  when you click the button.

## Files
`manifest.json`, `popup.html`, `popup.css`, `popup.js`, `content.js`, `README.md`, `icons/`
