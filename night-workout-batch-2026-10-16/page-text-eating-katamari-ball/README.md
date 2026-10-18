# Katamari Text Muncher — Page Game

A silly page game: roll a colorful ball around the page and visually "munch" words. Move your mouse — the ball follows, and every word it touches gets covered with a dot of paint. The ball grows as it eats. Fully reversible with one click.

## How it works

1. Pick a ball size and color, click **Roll the ball**.
2. Move your mouse to roll. The score counts munched words.
3. Press **Esc** to stop the ball, or **Reset page** to restore everything.

## Honest scope

- **Game only.** Words are covered by dots on a separate canvas layer — the page's DOM is never modified.
- Fully reversible: Reset removes both overlay canvases and all marks.
- Up to 700 visible words are tracked per page (a cap for performance).
- 100% local, zero network. Settings persist in `chrome.storage.local`.

## Permissions

- `activeTab` + `scripting`: start the game in the tab you choose, on your explicit click.
- `storage`: remember your ball settings.

## Files

- `manifest.json` — Manifest V3 config
- `popup.html` / `popup.css` / `popup.js` — 380px glassmorphism popup, green accent
- `content.js` — dual-canvas ball + cover-dot game (guarded against double injection)
- `icons/` — generated PNG icons
