# Cursor Fireworks — Trailing Particle FX

Sparkling particle fireworks that trail your cursor on any page. Pure visual fun — user-triggered, nothing tracked, no network.

## Features
- **Three particle styles**: Sparkle (star glints), Embers (rising warm dots), Bubbles (floating rings)
- Density slider (1–10), live style switching
- Canvas overlay with `pointer-events: none` — pages stay fully clickable
- Pauses automatically when the tab is hidden

## Install
1. Open `chrome://extensions`, enable Developer mode
2. Load unpacked → select this folder (or install the `.zip` via your browser's extension page)

## Permissions
- `storage` — remembers your style/density prefs
- `activeTab` + `scripting` — injects the particle overlay only on the tab where you press Start

## Honest scope
Decorative ambience toy. Runs only when you start it, stops on demand or when you close the popup. No analytics, no tracking, no network requests.
