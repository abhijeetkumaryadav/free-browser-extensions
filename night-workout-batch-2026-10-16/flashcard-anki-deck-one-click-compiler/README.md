# Flashcard Deck Compiler

Create flashcard decks, review them with a flip-card UI, bulk-import
front↔back pairs, and export **one-click Anki-importable .tsv**.

## Honest scope

- The "Anki" part is an exported file you import yourself in Anki
  (File → Import in the desktop app). There is **no AnkiConnect connection**
  and this extension never talks to Anki or any server.
- 100% local. Permission: `storage` only.

## Files

- `manifest.json` — Manifest V3
- `popup.html` / `popup.css` / `popup.js` — decks, cards, review, export
- `icons/` — generated PNG icons (16/48/128)
