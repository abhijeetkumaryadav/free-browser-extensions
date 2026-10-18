# Word Cloud — Comment Frequency Visualizer

**Frequency cloud only — counts words, judges nothing. Not sentiment AI.**

Paste comments (one per line) and see which words dominate, drawn as a canvas
word cloud sized by frequency.

## What it does

- **Input tab** — paste comments, optionally ignore words shorter than 3
  letters, press *Build cloud*.
- **Cloud tab** — canvas word cloud: bigger words = more frequent. Reshuffle
  the layout or download it as a PNG.
- **Notes tab** — your own observations, autosaved locally.
- **Top words list** — exact counts for the 15 most frequent words.

## How counting works

1. Text is lowercased; URLs are dropped.
2. Tokens are split on whitespace/punctuation (apostrophes kept).
3. A built-in stopword list (`the`, `and`, `is`, …) is excluded.
4. Pure numbers and sub-minimum-length words are excluded.
5. Font size scales with the square root of each word's count, so rare
   words stay visible instead of vanishing.

Everything is fully local (`storage` permission only). No network calls,
no AI, no sentiment analysis.

## Files

- `manifest.json` — Manifest V3
- `popup.html` / `popup.css` / `popup.js`
- `icons/icon{16,48,128}.png`
- Engine functions (between `ENGINE-START` / `ENGINE-END` in `popup.js`) are
  headless-testable in Node.

## Validation

- `node --check popup.js` ✅
- `manifest.json` parses, Manifest V3 ✅
- Icons exact 16/48/128 ✅
- `manifest.json` at ZIP root ✅
- Headless engine tests: **14/14 pass** (tokenization, URL stripping,
  stopwords, numbers, minLen, top-N ordering, font-size scaling)
