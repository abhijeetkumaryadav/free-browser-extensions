# GradCraft — CSS Gradient Builder v1.0.0

A polished local tool that builds beautiful CSS gradients visually — no network, no tracking.

## Features
- **Live preview** of the gradient
- **Linear & radial** modes (circle / ellipse shape for radial)
- **Angle control** (0–360°) for linear gradients
- **Up to 8 color stops**: per-stop color picker + position slider, add/remove
- **Random gradient** button from a curated palette
- **One-click Copy CSS** (`background: linear-gradient(...);`)
- State (type, angle, stops) **persisted locally** via `chrome.storage.local`

## Install (unpacked)
1. Unzip the release package so `manifest.json` is at the folder root.
2. Open `chrome://extensions` (Chrome/Edge) — or `about:debugging#/runtime/this-firefox` in Firefox.
3. Enable **Developer mode** → **Load unpacked** → select the folder.
4. Click the toolbar icon to open GradCraft.

## Permissions justification
- `storage` — remembers your gradient (type, angle, stops) between sessions. Nothing else.

## Publishing notes
- Manifest V3, no remote code, no network requests, no analytics.
- Firefox-compatible (uses standard WebExtensions APIs only).

## Honest scope
- Purely a local CSS generator. It does not inspect pages or alter websites.
