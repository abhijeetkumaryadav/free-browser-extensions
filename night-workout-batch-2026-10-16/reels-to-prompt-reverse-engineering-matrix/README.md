# Reel Matrix — Reel Structure Logbook

A manual logbook for creators: log the **observable structure** of reels you study
(hook type, beat timing, caption style, audio, CTA) and spot recurring patterns
across **your own notes** with a comparison matrix.

## Honest scope

- **Manual observation logbook only.** It cannot see, measure, or infer any
  platform's ranking algorithm.
- "Patterns" = frequency counts inside *your* logged entries, nothing more.
- 100% local (`chrome.storage.local`). Zero network calls. Nothing leaves the browser.

## Features

- **Log tab** — structured form: label, optional source URL, hook type, hook
  seconds, total seconds, caption style, audio type, CTA, views bucket, notes.
- **Matrix tab** — per-dimension frequency bars (top values + counts),
  top recurring hook/caption/audio/CTA combos, and average hook/total timing.
  Requires at least 2 logged reels.
- **Reels tab** — entry list with delete, JSON export, and clear-all.
- Deep-dark glassmorphism UI (380px popup), single rose accent.

## Permissions

- `storage` — persists your logged reels locally.

## Install (development)

1. Open `chrome://extensions`, enable **Developer mode**.
2. **Load unpacked** → select this folder.
3. Pin the extension and open the popup.

## Validation

- `node --check` on all JS files
- `manifest.json` parses (Manifest V3)
- Icons generated (16/48/128 PNG)
