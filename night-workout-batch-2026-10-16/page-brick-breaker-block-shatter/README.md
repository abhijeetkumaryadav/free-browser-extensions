# Brick Breaker: Page Block Shatter

A user-triggered brick-breaker game. The visible blocks of the current page
become the bricks, drawn on a canvas overlay — **the page DOM is never
modified**, so shattering is purely visual.

## How it works

1. Click the extension icon → **Start game on this tab**.
2. A full-viewport canvas overlay appears; page blocks are cloned as colored
   bricks (position clones only).
3. Move your mouse to steer the paddle. Bounce the ball, shatter bricks (+10
   each), 3 lives, +100 bonus for clearing the board.
4. Press **Esc** or the exit button to quit. The overlay is removed and the
   page is restored exactly as it was.

## Honest scope

- Game only — user-triggered, fully reversible.
- The page is never modified; bricks are visual clones on an overlay.
- Scores (high/last) are stored locally in `chrome.storage.local`.
- Permissions: `activeTab`, `scripting` (inject the game on click), `storage`.

## Permissions rationale

- `activeTab` + `scripting`: inject the game canvas into the tab you explicitly
  start the game on.
- `storage`: remember high score, last score, and difficulty.
