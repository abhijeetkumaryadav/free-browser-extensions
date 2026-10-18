# Circuit Wiring Simulator

A harmless visual toy for Chrome, Edge, Firefox, and Opera (Manifest V3).

## What it does

Draws animated "circuit wiring" lines connecting the visible elements of the
current page — each element gets a pulsing circuit node, and glowing pulses
travel along the wires in PCB-style orthogonal routing. Three wire styles:
**Hub**, **Chain**, and **Elbow**, plus pulse-speed and node-count sliders.

## Honest scope

- **Toy only.** It changes nothing about the page: the entire effect renders on
  a single fixed-position, pointer-events-none canvas overlay.
- **Fully reversible.** "Remove overlay" deletes the canvas entirely — the page
  is exactly as it was. Refreshing the page also clears it.
- Runs only when you click **Show wiring on this tab**. Nothing runs in the
  background, nothing is transmitted anywhere, and nothing persists except your
  style/speed/node-count settings (stored locally).

## Files

- `manifest.json` — MV3 manifest
- `popup.html` / `popup.css` / `popup.js` — settings popup
- `content.js` — canvas overlay toy (guarded against double injection)

## Permissions

`storage` (settings), `activeTab` + `scripting` (inject the overlay only on the
tab you explicitly click for — never automatically).
