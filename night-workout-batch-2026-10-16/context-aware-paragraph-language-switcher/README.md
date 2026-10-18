# Script Labeler — Paragraph Script Guesser

One-click tool that scans the paragraphs on the current page and attaches a small
badge to each one showing its heuristically-guessed **writing script**
(Latin, Cyrillic, Arabic, Devanagari, CJK, Thai, Hebrew, Greek).

**Scope (honest):** this guesses the *script family* from Unicode ranges
(majority vote over a paragraph's letters). It is **not language detection**
(e.g. it cannot tell English from French) and it does **not translate** anything.
Guesses can be wrong — badges carry a tooltip saying so.

## How it works
1. Click **Label paragraphs** — the content script is injected click-only
   (internal `chrome://` pages are refused with a friendly message).
2. Each paragraph with ≥12 characters gets a small badge appended; the page's
   own text is never touched.
3. Click **Clear labels** to remove every badge.

## Files
- `manifest.json` — Manifest V3
- `popup.html` / `popup.css` / `popup.js` — popup + injection orchestration
- `content.js` — file-based, message-driven, boot-once guarded labeler
- `icons/` — 16/48/128 PNG icons

## Permissions
- `storage` — remembers the last run's summary only
- `activeTab` + `scripting` — injects the labeler on explicit click only

## Privacy
100% local. Nothing is sent anywhere.
