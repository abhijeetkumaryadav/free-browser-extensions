# Tab Terrarium

A tiny virtual terrarium living in your toolbar. Your plant grows in **real time as you browse** — even with the panel closed — progressing Seed → Sprout → Sapling → Budding → Bloom. Water it, feed it, and watch it thrive. 100% local: no network, no accounts.

## How it works

- A background alarm ticks every **5 minutes**: water evaporates (−8), and growth advances (+6 when hydrated, +1 when parched).
- **Catch-up math** means the plant state is correct even if the browser was closed — missed ticks are applied on wake (capped at 24h).
- **Water** (+35 hydration), **Feed** (+12 growth, requires some water), **Replant** (start over).
- Stats: total waterings, feedings, plant age.

## Honest scope

- It's a game, not a botanical simulation. Growth rates are tuned for fun (~2 hours to full bloom with care).
- The plant is drawn procedurally as SVG — no image assets.
- Nothing leaves your device.

## Install (developer mode)

1. Open `chrome://extensions`, enable **Developer mode**.
2. **Load unpacked** → select this folder.
3. Click the toolbar icon to visit your terrarium.

## Permissions

| Permission | Why |
|---|---|
| `storage` | Plant state, growth, stats |
| `alarms` | 5-minute growth ticks in the background |

## Files

`manifest.json` · `popup.html` · `popup.css` · `popup.js` (SVG rendering + actions) · `background.js` (growth engine, alarms, catch-up) · `icons/` · `README.md`

v1.0.0 — Manifest V3.
