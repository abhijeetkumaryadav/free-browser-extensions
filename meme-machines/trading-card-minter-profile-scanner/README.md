# CardForge — Trading Card Minter v1.0.0

Mint a trading card for any profile, just for fun: enter a name, title,
flavor text and stats — or pull the name straight from the current tab's
title — pick one of three original card-art styles and a rarity, then
download the canvas-rendered card as a PNG.

## Features
- **Card editor** — name, title/epithet, flavor text, HP / ATK / DEF.
- **From tab** — fills the card name from the active tab's title (one click).
- **3 original art styles** — Cosmic, Forest, Ember (PIL-generated, bundled locally).
- **4 rarities** — Common, Rare, Epic, Legendary (foil shimmer on Epic/Legendary).
- **Randomize stats** — dice button for quick stat rolls.
- **Download PNG** — 600×840 card image via a plain anchor download.
- Form state autosaves locally so your card survives popup closes.

## Install
1. Unzip `trading-card-minter-profile-scanner.zip`.
2. Open `chrome://extensions` (Chrome/Edge) or `edge://extensions`.
3. Enable **Developer mode** → **Load unpacked** → select the folder.
4. Firefox: `about:debugging#/runtime/this-firefox` → Load Temporary Add-on
   (pick `manifest.json`).

## Permissions (justified)
- `storage` — autosave your card draft on-device.
- `tabs` — read the **title** of the active tab only when you click "From tab".
  Nothing else is read.

## Publishing notes
- Chrome Web Store: "justification for tabs permission" — reads the active
  tab's title on explicit user click to prefill the card name.
- All artwork is original and generated for this extension; no third-party IP.
- No network calls, no remote code, no analytics.
