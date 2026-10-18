# TetraFall — Side Panel Tetris Arcade

A polished, fully playable Tetris arcade that lives in your browser. Open the game
board from the popup, chase high scores, and come back anytime — scores persist on-device.

## Features

- Canvas-rendered 10×20 board with all 7 tetrominoes
- Ghost piece, hold piece (`C`), and 3-piece next preview
- Smooth rotation with wall kicks
- Scoring (100/300/500/800 × level), levels that speed up every 10 lines
- Pause (`P`), game over screen, and a local top-10 high-score table
- Keyboard controls: `←` `→` move, `↓` soft drop, `Z`/`↑` rotate,
  `Space` hard drop, `C` hold, `P` pause, `N` new game

## Install

**Chrome / Edge / Opera**
1. Unzip `tetris-side-panel-arcade.zip` anywhere.
2. Open `chrome://extensions`, enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

**Firefox**
1. Open `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on**.
2. Select `manifest.json`. (Temporary add-ons unload on browser restart; the
   Firefox Add-ons store is required for permanent installs.)

## Permissions

| Permission | Why |
|---|---|
| `storage` | Saves your top-10 high scores on-device. Nothing else. |

No network calls, no analytics, no data leaves your device.

## Publishing notes

- Manifest V3. No remote code; all game logic is bundled.
- Screenshots: capture the game board tab at 1280×800 for the store listing.
- Single-purpose arcade game — declare it as a game in the store questionnaire.

## Version history

- **1.0.0** — Initial release: full Tetris engine, ghost/hold/next, levels, high scores.
