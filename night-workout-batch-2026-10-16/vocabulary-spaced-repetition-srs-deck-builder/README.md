# Flashdeck SRS — Spaced Repetition Decks

Create decks of flashcards and review them with a simplified SM-2 spaced-repetition
scheduler. Everything is stored locally in your browser.

## What it does

- Create named decks; add front/back cards to each.
- Review due cards: tap **Show answer**, then grade **Again / Good / Easy**.
- Simplified SM-2 scheduling:
  - **Again** — card resets to today, ease drops slightly.
  - **Good** — interval grows 1 → 6 days → × ease.
  - **Easy** — ease increases, interval grows faster.
- Deck list shows due counts at a glance; per-card delete; delete whole decks.
- Export any deck as JSON; import cards from a JSON file (array or `{cards: [...]}`).

## Honest scope

Simplified SM-2 only — it does not implement the full SuperMemo algorithm, and it
never touches the network. No accounts, no analytics.

## Files

- `manifest.json` — MV3 manifest (permission: `storage`)
- `popup.html` / `popup.css` / `popup.js` — deck management, review UI, SM-2 engine

## Install

1. Open `chrome://extensions`, enable Developer mode.
2. Load unpacked → this folder.
3. Make a deck and start reviewing.
