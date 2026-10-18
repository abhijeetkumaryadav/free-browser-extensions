# Cursor Gravity Particles

A harmless visual toy: colorful particles on a canvas overlay are gravitationally
attracted to your cursor, with glowing trail effects.

## What it does
- Click **Start particles** in the popup (explicit click only).
- A full-viewport canvas overlay appears; ~140 colorful particles drift around
  and get pulled toward your cursor.
- Sliders: **gravity** strength, **particle count**, **trail length** — live.
- **Stop & clear** (or press `Esc`) removes the overlay completely.

## Honest scope
- The page underneath is **never touched** — the game lives on its own canvas
  layer with `pointer-events: none`.
- 100% local, zero network. No data leaves the browser.

## Permissions
- `storage` — remember your gravity/count/trail preferences.
- `activeTab` + `scripting` — inject the toy into the current tab only when you
  click the button.

## Files
`manifest.json`, `popup.html`, `popup.css`, `popup.js`, `content.js`, `README.md`, `icons/`
