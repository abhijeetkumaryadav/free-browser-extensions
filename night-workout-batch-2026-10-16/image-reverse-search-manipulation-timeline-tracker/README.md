# Image Check Journal — Reverse Search Launcher v1.0.0

Log images you are checking: a description, an optional image URL, and your
own verdict (Undecided / Looks real / Edited / Misattributed / AI-generated).
Each entry offers one-click reverse-search launchers for Google Lens, TinEye,
and Bing Visual — if you gave an image URL it searches that URL directly,
otherwise it opens the provider's search page for manual upload/paste.

## Honest scope
- Your journal only — **launches searches, doesn't analyze** images.
- The extension itself makes no network calls; only the search tabs you
  choose to open.
- Your verdicts are yours; nothing is verified automatically.

## Privacy
Everything stays in `chrome.storage.local`.

## Files
- `manifest.json` — MV3, `storage` permission only
- `popup.html` / `popup.css` / `popup.js` — UI + engine
- `icons/` — 16/48/128 PNG
