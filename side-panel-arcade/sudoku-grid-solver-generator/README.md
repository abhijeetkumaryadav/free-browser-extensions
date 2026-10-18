# Sudoku Grid — Solver & Generator

Play Sudoku with guaranteed unique-solution puzzles, or paste any puzzle to solve it instantly.

## Install (unpacked)

1. Download and unzip `sudoku-grid-solver-generator.zip`.
2. Open `chrome://extensions` (Chrome/Edge) or `about:debugging#/runtime/this-firefox` (Firefox).
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the unzipped folder.
5. Click the toolbar icon to play.

## Features

- **Generator**: 4 difficulties (Easy / Medium / Hard / Expert). Each puzzle is dug from a random full grid while preserving a *unique* solution (verified by a solution-counter).
- **Play**: click a cell and use the number pad (or keyboard 1–9), pencil marks (✎ toggle or `P`), mistake highlighting toggle, hint button (fills one correct cell), timer, win detection.
- **Solver** (magnifier icon): type or paste 81 characters (digits, `0` or `.` for empties) → instant solve with step count and solve time; or load the puzzle onto the board to play it.
- Progress auto-saves on-device.

## Permissions

- `storage` — saves your current game locally. No network calls, no host permissions.

## Publishing notes

- Pure client-side logic, zero dependencies. Safe for Chrome Web Store / Edge Add-ons / Firefox AMO review.
