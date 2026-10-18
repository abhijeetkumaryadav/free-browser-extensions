# DOM Tetris — Page Overlay Game

A harmless, user-triggered Tetris game that plays on a dark overlay above the
current tab. Tetromino pieces are styled like DOM nodes (`<div>`, `<span>`,
`<button>`…).

## What it does

- Click **Play on this tab** in the popup to start the game overlay.
- Keyboard controls:
  - ← / → — move piece
  - ↓ — soft drop
  - ↑ — rotate
  - Space — hard drop
  - P — pause
  - Esc — remove the game
- Score, level (speeds up every 10 lines), lines, next-piece preview, high score.
- Click **Remove game** (or press Esc) to remove the overlay entirely.

## Honest scope

- **Game only.** The page DOM is never read, modified, or inspected — the game
  renders on its own overlay layer.
- **User-triggered.** Nothing starts automatically; only your click starts it.
- **Fully reversible.** One click (or Esc) removes every trace from the page.
- **100% local.** No network requests, no data collection, no remote code.

## Permissions

- `activeTab` + `scripting` — inject the game overlay into the tab you click on,
  only when you click the button.

## Files

- `manifest.json` — MV3 manifest
- `popup.html` / `popup.css` / `popup.js` — popup UI and tab injection
- `content.js` — the Tetris game (injected on demand, never auto-run)
- `icons/` — generated PNG icons
