# Glyph Tetris — Text-Character Tetris

Tetris played entirely in the extension popup — except every block cell is drawn as a
text character (glyph) instead of a solid square.

**What it does**
- Standard tetris: 7-bag randomizer, ghost piece, next-piece preview, levels speed up
  every 10 lines, classic scoring (100/300/500/800 × level)
- **Glyph blocks:** each piece type draws with a character from a customizable set
  (default `█▓▒░#@$%&*+?`); edit the set in the Character sets panel — it persists
- Controls: ←/→ move, ↓ soft drop, ↑ rotate, Space hard drop, P pause
- Best score persisted in `chrome.storage.local`

**Honest scope:** offline game in the popup. Zero network calls, no permissions beyond
`storage`. Nothing leaves the machine.

**Files:** `manifest.json` (MV3), `popup.html`, `popup.css`, `popup.js`, `icons/`, `README.md`.
