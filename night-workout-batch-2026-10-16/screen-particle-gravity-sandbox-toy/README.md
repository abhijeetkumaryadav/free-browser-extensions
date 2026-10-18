# Gravity Sandbox — Screen Particles

A playful gravity sandbox that runs on any tab. Colorful particles drift across
your screen and swirl into gravity wells you place with a click.

## What it is

A **visual toy** — clearly labeled as such. Particles render on a full-screen
canvas overlay; the page underneath is never read, modified, or obscured
permanently. One click (or `Esc`) removes every trace.

## How to use

1. Click the extension icon and press **Start on this tab**.
2. **Click** anywhere on the page to drop a gravity well.
3. **Shift+Click** near a well to remove it.
4. Drag the sliders — gravity strength, particle count, trail length update live.
5. Press **Esc** (or the popup's **Stop** button) to exit and restore the page.

## Honest scope

- No physics engine claims beyond simple inverse-square attraction with damping.
- No data leaves your machine — 100% local, zero network, no analytics.
- Permissions used: `storage` (settings), `activeTab` + `scripting` (inject the
  overlay only when you click Start — never automatically).

## Files

- `manifest.json` — Manifest V3
- `popup.html` / `popup.css` / `popup.js` — 380px glassmorphism control panel
- `content.js` — canvas overlay simulation (injected on explicit click only)
- `icons/` — generated 16/48/128 PNG icons
