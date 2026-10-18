# Retro Asteroids — Page Overlay Game

A classic asteroids game that runs **on top of any tab** as a pure canvas overlay.

## Honest scope

- **Harmless game only.** Everything is drawn on a single `position:fixed` canvas. The extension never reads, moves, or removes page elements — the name "pulverizer" refers to blasting *game* asteroids, not anything on the page.
- The canvas is `pointer-events:none`, so the page stays fully clickable underneath.
- **Esc** (or the popup's "Remove overlay") cancels the animation frame, removes all listeners, and deletes the canvas — the page is left exactly as it was.

## How to play

1. Click the extension icon, then **Blast off on this tab**.
2. **←/→** rotate, **↑** thrust, **Space** shoot, **Esc** quit.
3. Big rocks split into two smaller ones (50/100/150 pts). Collisions cost a life; 3 lives. Clearing the field advances the level with more rocks.
4. Best score and games played persist in `chrome.storage.local`.

## Technical notes

- Boot-once guard prevents duplicate overlays on repeated clicks.
- Capture-phase key handlers only intercept game keys (arrows/space); Esc quits the game.
- All logic is canvas + `requestAnimationFrame` — no libraries, no network.

## Files

| File | Purpose |
|---|---|
| `manifest.json` | MV3 manifest (`activeTab`, `scripting`, `storage`) |
| `popup.html` / `popup.css` / `popup.js` | Launcher + best/games stats |
| `content.js` | Overlay game engine |
| `icons/` | Generated 16/48/128 PNG icons |
