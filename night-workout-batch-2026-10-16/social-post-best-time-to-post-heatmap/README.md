# Best-Time Heatmap — Your Posting Log

Log your own social posts (platform, day, hour, engagement notes) and see your posting
patterns as a day×hour heatmap drawn on canvas. "Best slots" ranks the day×hour cells
where most of *your* logged posts landed.

## Honest scope
- **No analytics API.** Nothing is fetched, measured, or verified.
- The heatmap reflects **only what you entered** — small samples mean weak conclusions.
- Everything stays in `chrome.storage.local`; no network calls.

## Features
- Log posts with platform, day, hour, engagement notes
- Canvas day×hour heatmap (Mon–Sun rows, 0–23 columns)
- Best-slots ranking from your own data
- Private observations tab (autosaved)
- JSON export / import backup

## Files
- `manifest.json` — Manifest V3, `storage` only
- `popup.html` / `popup.css` / `popup.js` — UI; engine functions between `ENGINE-START`/`ENGINE-END`
- `icons/` — 16/48/128 PNG

## Design
380px popup, deep-dark glassmorphism, single rose `#fb7185` accent, Lucide-style outline icons.
