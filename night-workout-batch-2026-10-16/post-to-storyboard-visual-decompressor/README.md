# Storyboard Decompressor

Decompress one post idea into a shot-by-shot storyboard plan.

## What it is

A creative planning board. You start with a single post idea (a reel, a carousel,
a video) and break it into ordered **frames**:

- **Hook** — the opening that grabs attention
- **Beat** — each content beat in sequence
- **CTA** — the call to action at the end
- **Note** — reminders, B-roll ideas, music cues

Each frame holds a shot title, freeform visual/script notes, and an estimated
duration. Frames can be reordered, retyped, and deleted.

## Features

- Add / edit / delete / reorder frames (up–down controls)
- Per-frame type with color coding (Hook / Beat / CTA / Note)
- Estimated total runtime computed from per-frame seconds
- Working title for the board
- **Copy outline** — paste-ready markdown outline of the storyboard
- **Export JSON** — full board data for reuse elsewhere
- Everything persists in local storage; nothing leaves the device

## Honest scope

This is a planning tool, not AI. It does not generate ideas, scripts, or images —
you write everything. There is no analysis, no scoring, and no network access.

## Privacy

- 100% local. No network requests, no accounts.
- Data lives only in `chrome.storage.local` on this device.

## Files

- `manifest.json` — Manifest V3 declaration
- `popup.html` / `popup.css` / `popup.js` — the 380px glassmorphism UI
- `icons/` — generated PNG icons (16/48/128)
