# Workout Roulette — Micro Exercise Spinner

Spin a canvas roulette wheel that picks a random exercise + duration from
a bundled list, then log the workout. Fully local, zero network.

**Honest scope:** For fun — not coaching. Picks are random from the bundled
list; nothing is a workout plan or medical advice.

## Features

- Animated canvas roulette wheel (12 exercises, eased 5–7 turn spins)
- Spin → random exercise + duration ("Do it for 1m 00s")
- **Log this workout** button records it with a timestamp
- Workout history (newest first), per-entry delete, clear-all with confirm
- Wheel math in a pure, headless-testable engine
- Everything stored in `chrome.storage.local`

## Files

| File | Purpose |
|---|---|
| `manifest.json` | MV3 manifest (`storage` only) |
| `popup.html` / `popup.css` / `popup.js` | 380px deep-dark glassmorphism UI, canvas wheel, spin engine |
| `icons/` | 16 / 48 / 128 px generated PNG icons |
| `README.md` | This file |

## Permissions

- `storage` — workout history log only

Zero network. Fully local.
