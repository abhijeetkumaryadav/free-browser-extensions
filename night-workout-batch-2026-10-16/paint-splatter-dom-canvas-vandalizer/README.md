# Paint Splatter — Page Paint Toy

A playful art toy for your browser: splatter colorful paint blobs onto a canvas overlay over any webpage. Click or drag to paint, pick a color, adjust brush size and splat spread — then clear everything with one click.

## How it works

1. Click **Start painting** in the popup (color, brush size, spread are saved).
2. A full-page canvas overlay appears. Drag on the page to splatter paint.
3. Press **Esc** or the popup's **Clear all** to remove the overlay entirely.

## Honest scope

- **Playful art toy only.** Despite the folder name, nothing is "vandalized."
- The page's own DOM is **never modified** — paint lives on a separate canvas layer above the page.
- Fully reversible: one click removes every trace.
- 100% local, zero network. Settings persist in `chrome.storage.local`.

## Permissions

- `activeTab` + `scripting`: inject the overlay into the tab you choose, on your explicit click.
- `storage`: remember your paint settings.

## Files

- `manifest.json` — Manifest V3 config
- `popup.html` / `popup.css` / `popup.js` — 380px glassmorphism popup, pink accent
- `content.js` — canvas overlay painter (guarded against double injection)
- `icons/` — generated PNG icons
