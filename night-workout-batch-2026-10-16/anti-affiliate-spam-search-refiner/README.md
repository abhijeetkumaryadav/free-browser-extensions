# Anti-Affiliate Spam Search Refiner

User-triggered, fully reversible heuristic filter for affiliate-heavy search results.

## What it does

1. Click **"Scan & dim affiliate spam"** in the popup on any search-results page.
2. The page is scanned for bundled affiliate signals:
   - affiliate disclosure text ("affiliate link", "we may earn a commission", …)
   - affiliate/tracking URLs (redirects, `tag=`, `ref=`, `aff_id=`, network domains)
   - listicle-bait titles ("Best 10 …", "Top 7 …") and best-list + buy-now combos
3. Matching cards are **dimmed** (or **collapsed**, your choice) with a count and per-item "why" reasons in the popup.
4. **Restore page** returns every card exactly (original inline styles are stashed first).

## Honest scope

- **Heuristic only** — signals can miss and misfire. Always review dimmed cards yourself.
- **Your choice** — nothing runs until you click; dimmed cards are your decision, not a verdict.
- **Reversible** — one click restores the page exactly.
- 100% local, zero network calls. Permissions: `storage`, `activeTab`, `scripting` (click-only injection; `chrome://` pages guarded).

## Files

- `manifest.json` — Manifest V3
- `popup.html` / `popup.css` / `popup.js` — popup UI and stats
- `content.js` — scan/dim/restore engine (message-driven, boot-once)
- `icons/` — 16/48/128 PNG icons
