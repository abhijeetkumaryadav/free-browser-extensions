# Clickbait Signal Scanner — Heuristic Headline Checker

**Honest scope: heuristic signals only — no AI summarization, no network.**
Paste a headline and the extension scores it against a set of hand-written
clickbait signal patterns (curiosity-gap phrases, exclamation marks, ALL-CAPS,
listicle openers, question bait, number bait, urgency words, hype
superlatives). A 0–100 score and per-signal breakdown are shown. A second
field lets you write **your own rewrite** — what the headline is actually
saying — saved locally.

## What it does
- Paste a headline → Scan signals → score ring + verdict + per-signal list
- Your rewrite field (autosaved locally)
- Headline remembered between sessions (local storage only)

## What it does NOT do
- No AI summarization or "truth detection" — it counts textual signals only
- Nothing leaves the browser; zero network calls

## Privacy
All data stays in `chrome.storage.local`. No accounts, no tracking.

## Install (development)
1. Open `chrome://extensions`, enable Developer mode
2. Load unpacked → select this folder
3. Click the toolbar icon to open the popup
