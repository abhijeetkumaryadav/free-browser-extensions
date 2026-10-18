# HTML Tag Memory Match — Brain Trainer

A memory-match card game that lives in the extension popup. Pair each HTML
tag card with its description card.

## Gameplay

- Pick a grid: 4×3 (6 pairs), 4×4 (8 pairs), or 6×4 (12 pairs), then hit **New game**.
- Click cards to flip them; match each `<tag>` with its description.
- Move counter, live timer, and matched-pairs counter track your run.
- Win banner shows your result; best score (moves + time) is saved **per grid size** in `chrome.storage.local`.

## Honest scope

- Labeled as a **game** — an educational toy for learning HTML tags.
- Fully in-popup, 100% local, zero network. No remote code, no secrets.

## Tech

- Manifest V3, `storage` permission only.
- 380px deep-dark glassmorphism popup, single violet `#a78bfa` accent, Lucide-style outline icons.

## Install (developer mode)

1. Open `chrome://extensions`, enable Developer mode.
2. Load unpacked → this folder (or install the `.zip`).
3. Click the toolbar icon to play.
