# Etymology Hover — Personal Word Dictionary

Your **personal** word-etymology dictionary. Add words with their origins/notes; hover matching words on any page for a tooltip. Fully local.

## What it does
- Add **word → etymology note** entries (persisted in `chrome.storage.local`).
- Toggle **hover tooltips on this tab** — the content script (click-only injection) wraps whole-word matches in dotted-underline spans; hovering shows your note in a tooltip.
- Toggle off (or the ✕ on the tab) restores the page exactly — text is never destructively modified.

## Honest scope
This is **your dictionary, not a real etymology dictionary**. It shows only the entries you write; it cannot look up real etymologies, and hover matches are whole-word text matches of your keys. Nothing leaves the browser.

## Files
`manifest.json`, `popup.html`, `popup.css`, `popup.js` (entry engine between `ENGINE-START`/`ENGINE-END`), `content.js` (hover engine), `background.js`, `README.md`, `icons/`.
