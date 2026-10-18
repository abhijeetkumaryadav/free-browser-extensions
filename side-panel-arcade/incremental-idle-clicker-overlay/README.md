# ClickIdle — Idle Clicker Game v1.0.0

An idle clicker game that lives in your browser toolbar.

## Features
- **Tap to earn** — click the big amber button to earn shards, with floating `+N` feedback
- **5 upgrade lines** — tap-power upgrades (Sturdy Cursor, Golden Finger), auto-earners (Shard Drone, Auto Forge), and multiplier tiers (Amplify) with escalating costs
- **Idle earnings** — auto-earners keep working; reopening the popup credits 25% of earnings while you were away (capped at 8 hours)
- **Prestige** — at 250,000 lifetime shards, reset for a permanent multiplier boost (×1.25 per 250k)
- **Statistics** — lifetime earned, taps, play time, prestige count; full progress reset
- Everything stored in `chrome.storage.local` — no accounts, no network, works offline

## Install
1. Unzip `incremental-idle-clicker-overlay.zip`
2. Open `chrome://extensions` (Edge: `edge://extensions`)
3. Enable **Developer mode**
4. **Load unpacked** → select the unzipped folder
5. Pin ClickIdle to the toolbar and start tapping

Firefox: `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → select `manifest.json`.

## Permissions
| Permission | Why |
|---|---|
| `storage` | Saves your game progress, upgrades, and statistics on-device |

No host permissions, no network calls, no data leaves your device.

## Publishing notes
- Manifest V3, no remote code, no analytics — store-safe
- Single `storage` permission is the minimum viable set
- Screenshots: popup at 380px width; feature graphic should show the click button + upgrade list
