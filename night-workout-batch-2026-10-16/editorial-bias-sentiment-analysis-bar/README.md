# Tone Word Counter — Heuristic Sentiment Bar

**Honest scope: word-count heuristic only — NOT real bias or sentiment analysis.**
Paste article text and the extension counts loaded positive/negative words
from a built-in hand-written word list, showing a negative/positive ratio bar,
per-word hit lists, and total words scanned. It cannot detect bias, irony,
sarcasm, or context — it literally counts words.

## What it does
- Paste text → Count tone words → ratio bar + hit lists
- Word lists are bundled in `popup.js` (edit them if you want your own)
- Text remembered between sessions (local storage only)

## What it does NOT do
- No bias analysis, no sentiment AI, no network — word counting only

## Privacy
All data stays in `chrome.storage.local`. No accounts, no tracking.

## Install (development)
1. Open `chrome://extensions`, enable Developer mode
2. Load unpacked → select this folder
3. Click the toolbar icon to open the popup
