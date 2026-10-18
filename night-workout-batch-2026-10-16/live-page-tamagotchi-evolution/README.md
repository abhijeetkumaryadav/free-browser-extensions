# TamaBloom — Virtual Page Pet

A tiny virtual pet that lives in your browser. Feed it, play with it, clean up after it, and watch it evolve from an **Egg → Baby → Child → Teen → Adult** as you browse.

## Features

- **Living pet** — hunger / happiness / energy meters decay in real time (even while the browser is closed), via a 5-minute background alarm with catch-up
- **5 life stages** — evolves automatically based on age: Egg (0–30m), Baby (30m–2h), Child (2–6h), Teen (6–12h), Adult (12h+)
- **Moods** — happy, neutral, sad, sleepy, grumpy; the pet's face is drawn procedurally per stage + mood
- **Care actions** — Feed, Play, Clean (it poops! 💩), Sleep/Wake; bond points track lifetime care
- **No death** — neglect makes it grumpy, never kills it; "Revive with love" restores a fully-neglected pet
- **Renameable** — click its name
- **Mini-pet widget** — optional draggable floating pet on any page, showing its weakest meter, refreshing every minute

## Install (developer mode)

1. Open `chrome://extensions`, enable **Developer mode**
2. **Load unpacked** → select this folder
3. Click the extension icon to meet your pet

## Permissions

| Permission | Why |
|---|---|
| `storage` | Persist pet state (meters, stage, name) locally |
| `alarms` | Decay meters every 5 minutes in the background |

No network requests. No tracking. Your pet never leaves your device.

## Honest scope

A fully local virtual-pet toy. Time-based decay is approximate (5-minute granularity). It cannot run its widget on `chrome://` pages or the Chrome Web Store (browser restriction).

## Publishing notes

- Manifest V3, no remote code — store-policy friendly
- Screenshots: show the popup at two different life stages
