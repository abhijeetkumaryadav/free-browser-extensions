# Reading Goals — Gamified Page Progress Tracker

Set a yearly reading goal (pages or books), log reading sessions, watch your progress ring fill, and keep a streak of reading days. Everything is **self-reported** — you enter the pages, the tracker just counts.

## Features

- Yearly goal in pages or books (1–100,000, clamped)
- Animated progress ring with percent
- Stats: total pages, distinct books, day streak
- Session log (book title + pages + date), newest first, per-session delete
- Autosaved personal notes
- All data in `chrome.storage.local`, 1,000-session cap

## Honest scope

This is your log — self-reported. It cannot verify you actually read anything.

## Files

- `manifest.json` — MV3, permissions: `storage` only
- `popup.html/css/js` — tracker UI + stats engine
- `icons/` — generated PNG icons (16/48/128)

## Privacy

Zero network calls. Your reading data never leaves your browser.
