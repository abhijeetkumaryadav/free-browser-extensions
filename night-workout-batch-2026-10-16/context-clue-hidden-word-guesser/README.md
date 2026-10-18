# Context Clue Word Guesser

A fully offline word-guessing game that lives in the extension popup. Read a context clue, guess letters, build streaks, and beat your best score.

## Game only — no network, no tracking

- **35 bundled word/clue pairs** — everything runs from local data.
- Guess letters with the on-screen alphabet or your physical keyboard.
- **Hints** reveal one letter for 15 points; **Skip** moves on but resets your streak.
- Win a round for a 100-point bonus plus 10 points per remaining life.
- Streaks of 5+ double letter points.
- Your best score is stored locally in the browser — nothing leaves your machine.

## Files

- `manifest.json` — Manifest V3, no permissions needed.
- `popup.html` / `popup.css` — 380px deep-dark glassmorphism UI, single lime accent, Lucide-style outline icons.
- `popup.js` — game logic.
- `icons/icon16.png`, `icon48.png`, `icon128.png` — generated PNG icons.

## Install (development)

1. Open `chrome://extensions` (or `edge://extensions`) and enable Developer mode.
2. Click **Load unpacked** and select this folder.
3. Click the extension icon to play.
