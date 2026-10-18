# Anagram & Crossword Page Solver

A real, fully local anagram solver and crossword pattern helper.

## What it does
- **Solve:** type letters → get every valid word formable from them, grouped longest-first.
- **Pattern filter:** enter a crossword pattern like `s_e_t` (`_` = any letter) to narrow results.
- **Grab selected text:** use the highlighted text on the current page as your letter rack.

## How it works (honest scope)
- 100% local letter-frequency matching against a bundled ~9,700-word English list (filtered from the public-domain dwyl/english-words list, 2–9 letters).
- No network, no AI, no server. Nothing you type leaves the popup.
- The bundled list favors common words — obscure dictionary words may be missing. That is a deliberate trade-off for a small package.
- Selection grab injects a read-only script only when *you* click the button; it cannot run on internal `chrome://` pages.

## Files
- `manifest.json` — MV3 manifest
- `popup.html` / `popup.css` / `popup.js` — UI and solver logic
- `words.js` — bundled word list
- `content.js` — selection reader (click-injected)
- `icons/` — generated PNG icons
