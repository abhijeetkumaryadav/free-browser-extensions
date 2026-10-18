# PixelRun — Micro Platformer

A tiny canvas platformer that lives in your browser. Run and jump across
platforms, collect coins, dodge spikes and reach the flag — across
6 hand-designed levels with increasing difficulty.

## Features

- 6 hand-designed levels: First Steps, Coin Row, Spike Alley, Gap Jumps,
  High Road (moving platform), Final Gauntlet (vertical elevator)
- Run / jump with coyote time + jump buffering for a tight feel
- Coins, spikes, bottomless pits, moving platforms
- 3 lives per attempt, pause (P), restart (R)
- Best time per level saved on-device, shown in the level-select popup
- Level select popup with best-time stars

## Controls

- ← / → or A / D — move
- Space / ↑ / W — jump
- P — pause · R — restart level

## Install

**Chrome / Edge / Opera:** unzip, open `chrome://extensions`, enable
Developer mode, click "Load unpacked", select the unzipped folder.

**Firefox:** open `about:debugging#/runtime/this-firefox`, click
"Load Temporary Add-on", select `manifest.json`.

## Permissions

- `storage` — saves best times per level on-device. Nothing leaves your machine.

## Publishing notes

- Manifest V3, no remote code, no network calls, no analytics.
- All art is drawn on canvas at runtime; icons are generated PNGs.

## Scope

Offline single-player game. Best times are stored locally in
`chrome.storage.local`; no accounts, no leaderboards, no network.
