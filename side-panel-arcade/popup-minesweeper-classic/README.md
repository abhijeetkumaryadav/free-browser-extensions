# Minefield — Classic Minesweeper

The classic Minesweeper, living in your browser toolbar. Three difficulties,
custom boards, persistent best times, and first-click safety.

## Features

- **Beginner** 9×9 / 10 mines, **Intermediate** 12×12 / 25 mines, plus **Custom**
  boards (up to 16×16, mines capped at 40% of cells)
- First click is always safe — mines are placed after it, avoiding the 3×3
  area around it
- Flood-fill reveal, right-click flags, live mine counter and timer
- Win/lose states with a mood face; best times saved per difficulty
- Classic number color palette, tuned for the dark theme

## Controls

- **Left-click** — reveal a cell
- **Right-click** — place / remove a flag
- Click the face to start a new game

## Install

**Chrome / Edge / Opera**
1. Unzip `popup-minesweeper-classic.zip` anywhere.
2. Open `chrome://extensions`, enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

**Firefox**
1. Open `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on**.
2. Select `manifest.json`. (Temporary add-ons unload on browser restart; the
   Firefox Add-ons store is required for permanent installs.)

## Permissions

| Permission | Why |
|---|---|
| `storage` | Saves best times per difficulty on-device. Nothing else. |

No network calls, no analytics, no data leaves your device.

## Publishing notes

- Manifest V3. No remote code; all logic is bundled.
- Screenshots: open the popup and capture at 380px width for the store listing.
- Single-purpose casual game — declare it as a game in the store questionnaire.

## Version history

- **1.0.0** — Initial release: 3 difficulties + custom boards, best times, first-click safety.
