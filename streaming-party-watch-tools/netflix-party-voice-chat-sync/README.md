# PartySync — Watch Party Coordinator

Coordinate manual watch parties: a shared 3-2-1 PLAY countdown, party notes, and timestamp logs. No accounts, no servers, no voice infrastructure.

## Features
- **Parties** — create and switch between named watch parties
- **3-2-1 PLAY countdown** — host starts it, everyone presses play on zero
- **Copy invite text** — share the plan via any chat app
- **Party notes** — "we're watching Episode 7", snack roster, etc.
- **Timestamp log** — log moments to revisit, with time-of-day stamps

## Honest scope
This is **manual coordination only**. There is no real-time playback sync, no voice chat, and no connection to Netflix or any streaming account. Everyone opens the same video themselves and presses play together.

## Install
1. Unzip the package.
2. Open `chrome://extensions` (Edge: `edge://extensions`), enable **Developer mode**.
3. Click **Load unpacked** and select the extracted folder.
4. Firefox: `about:debugging` → This Firefox → Load Temporary Add-on → choose `manifest.json`.

## Permissions (why each is needed)
- `storage` — saves your parties, notes, and timestamps on-device

## Publishing notes
- Manifest V3, no remote code, no network calls, no analytics.
- Do not use Netflix/party trademarks in the store listing title; "PartySync" is a generic name.
