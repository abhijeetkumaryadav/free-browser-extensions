# SnakeByte — Retro Snake

Classic retro snake game living in your browser toolbar. Steer with arrow keys or
WASD, eat the food, grow the snake, and chase the local high score.

## Features

- Canvas-rendered snake with smooth speed-up as you eat
- Arrow keys **and** WASD steering; `Space` pauses, `R` restarts
- Ghost-free collision: walls and self both end the run
- Level chip every 100 points, animated
- 1× / 2× speed toggle
- High score persisted in `chrome.storage.local` (on-device only)
- Pause overlay, game-over screen with final score

## Install (Chrome / Edge / Opera)

1. Unzip `retro-snake-keyboard-navigator.zip`.
2. Open `chrome://extensions`, enable **Developer mode**.
3. **Load unpacked** → select the unzipped folder.

For Firefox: open `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** →
select `manifest.json` (Firefox supports MV3 popups and `chrome.storage`).

## Permissions

| Permission | Why |
|---|---|
| `storage` | Save the local high score. Nothing else. No network calls, ever. |

## Notes

- Purely local game — no analytics, no network, no data collection.
- `ctx.roundRect` requires Chrome 99+ / Firefox 112+ / Edge 99+.
- Scores stay on this device; clearing extension storage resets the high score.

## Publishing notes

- MV3 only, no deprecated APIs, no host permissions — store-safe.
- No remote code, no user-data collection; privacy policy can state "no data leaves device".
