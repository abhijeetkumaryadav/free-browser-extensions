# Retro Snake Word Spelling Eater

A retro snake arcade game that plays on any tab. Steer the snake, eat letter
pellets **in word order** to spell words, and dodge the wrong letters.

## What it is

A **game** — clearly labeled as such. Everything renders on a full-screen
canvas overlay; the page underneath is never read, modified, or obscured
permanently. One click (or `Esc`) removes every trace.

## How to play

1. Click the extension icon, pick a difficulty, and press **Play on this tab**.
2. Steer with **Arrow keys** or **WASD**.
3. Eat the **green** letter tile — that's the next letter of the target word.
4. Avoid **pink** tiles — wrong letters cost a life (3 lives total).
5. Finish a word for a bonus, level up, and go faster. Spell your way up the
   best-score board.
6. **R** restarts after game over · **Esc** exits and restores the page.

## Honest scope

- Classic snake mechanics + spelling twist; bundled ~40-word list, no AI.
- No data leaves your machine — 100% local, zero network, no analytics.
- Permissions used: `storage` (difficulty + best score), `activeTab` +
  `scripting` (inject the game only when you click Play — never automatically).

## Files

- `manifest.json` — Manifest V3
- `popup.html` / `popup.css` / `popup.js` — 380px glassmorphism launcher
- `content.js` — canvas overlay game (injected on explicit click only)
- `icons/` — generated 16/48/128 PNG icons
