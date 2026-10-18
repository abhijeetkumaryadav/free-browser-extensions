# Non-Commercial Indie Web Search Tunnel

Type a query once, open it on the indie search engines you pick.

## What it does

1. Type a query in the popup.
2. Tick the indie engines you want (Marginalia, Wiby, Mojeek, LiteDuck — add your own with a `{q}` URL template).
3. Click **Launch search** (or Enter) — your query opens on each engine as a **background tab** (never steals focus). The popup closes after launching.

## Honest scope

- **Opens search pages — does NOT aggregate or scrape results.** Each site runs its own search after the tab opens.
- Fully local except the search tabs *you* choose to open. Permission: `storage` only (engine picks + custom engines).

## Files

- `manifest.json` — Manifest V3
- `popup.html` / `popup.css` / `popup.js` — launcher UI
- `icons/` — 16/48/128 PNG icons
