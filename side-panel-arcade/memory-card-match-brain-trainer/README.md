# MemoMatch — Memory Card Trainer

A classic memory-match card game in your browser toolbar. Flip pairs of
cards, clear the board in as few moves as possible, and beat your best.

## Features

- 3 difficulties: Easy 4×4 (8 pairs), Medium 6×6 (18 pairs), Hard 8×8 (32 pairs)
- 32 unique card faces: Lucide-style stroke icons + geometric shapes (no emoji)
- 3D card flip animation, mismatch flip-back delay
- Move counter, live timer, pairs progress
- Best score per difficulty (fewest moves, then fastest time) saved on-device
- Win screen with "new best" celebration, play again / change difficulty

## Install

**Chrome / Edge / Opera:** unzip, open `chrome://extensions`, enable
Developer mode, click "Load unpacked", select the unzipped folder.

**Firefox:** open `about:debugging#/runtime/this-firefox`, click
"Load Temporary Add-on", select `manifest.json`.

## Permissions

- `storage` — saves best scores per difficulty on-device. Nothing leaves your machine.

## Publishing notes

- Manifest V3, no remote code, no network calls, no analytics.
- All card art is inline SVG; icons are generated PNGs.

## Scope

Offline single-player game. Scores are stored locally in
`chrome.storage.local`; no accounts, no leaderboards, no network.
