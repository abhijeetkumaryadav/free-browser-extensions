# Feed Diversity Companion

**Live-Algorithm Recommendation Bias Shield** — honestly scoped as a feed-diversity awareness companion.

## What it does

- **Log feed sightings** — each time you notice a post in your feed, record its source/page, platform, and category.
- **Dashboard** — source-concentration score (Herfindahl index of your logged sources, 0–100), top-source share, top sources, and category mix.
- **Diversity nudges** — if one source dominates your log, you get a gentle nudge to broaden your mix.
- **Weekly reflection** — a guided check-in against your own logged data.

## Honest scope

- **Your logged data only.** The extension cannot read your feeds, cannot see any platform's recommendation algorithm, and provides **no shield or protection** of any kind.
- The concentration score describes *your attention* as you logged it — not what a platform did.
- Everything is stored locally in `chrome.storage.local`. Nothing is transmitted anywhere.

## Files

- `manifest.json` — MV3, `storage` permission only
- `popup.html` / `popup.css` / `popup.js` — the app (no content or background scripts; nothing touches web pages)
- `README.md`, `icons/icon{16,48,128}.png`

## Privacy

Zero network requests. No accounts. No tracking. Your log never leaves the browser.
