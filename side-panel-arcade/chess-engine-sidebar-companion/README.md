# PawnStorm — Chess vs Computer v1.0.0

Play chess against a built-in computer opponent, right from your toolbar.

## Features
- **Full chess rules** — legal move generation, check/checkmate/stalemate detection, castling, en passant, pawn promotion (auto-queen), 50-move rule
- **From-scratch engine** — minimax with alpha-beta pruning and piece-square tables; no Stockfish, no network, no accounts
- **3 difficulty levels** — Easy, Normal, Hard (iterative deepening with a time budget, so the popup never hangs)
- **Interactive board** — click-to-move with legal-move dots, last-move highlight, board flip, move list in algebraic notation, live engine evaluation
- **Takeback** — undo full move pairs; position persists across popup sessions
- Honestly labeled casual strength — a fun opponent, not a grandmaster

## Install
1. Unzip `chess-engine-sidebar-companion.zip`
2. Open `chrome://extensions` (Edge: `edge://extensions`)
3. Enable **Developer mode**
4. **Load unpacked** → select the unzipped folder
5. Pin PawnStorm to the toolbar and play (you are White)

Firefox: `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → select `manifest.json`.

## Permissions
| Permission | Why |
|---|---|
| `storage` | Saves your current game position, difficulty, and board orientation on-device |

No host permissions, no network calls, no data leaves your device.

## Publishing notes
- Manifest V3, zero remote code, zero analytics — store-safe
- Single `storage` permission is the minimum viable set
- Engine strength is casual by design; do not market as master-level
- Screenshots: popup at 380px width; feature graphic should show a mid-game board
