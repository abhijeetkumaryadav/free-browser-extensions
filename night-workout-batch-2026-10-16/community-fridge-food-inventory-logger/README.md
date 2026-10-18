# Community Fridge Inventory Logger

A local-first logbook for a community fridge: track what's in it, when it expires,
and who added it. No accounts, no server, no sync — everything stays in the browser
on the device where it's installed.

## Features

- Add items: name, category, quantity, expiry date, storage location (fridge / freezer / pantry shelf), and the name of the person who added it
- Dashboard: total items, expiring-soon count (≤ 3 days), expired count, per-category counts
- Expiring-soon alerts banner with a "mark as taken/removed" flow
- Mark items taken (removed) or delete them
- **Coordinator summary**: generates a plain-text shareable summary (stock by category, expiring items, restock suggestions) — copy it into any group chat; nothing is sent automatically
- Filter by location and category; search by name

## Honest scope

This is a **single-device logbook**. Multiple people can use the same installed copy
(by typing their name on each item), but there is no real-time multi-device sync.
For a busy fridge, designate one shared device or export/copy the coordinator
summary regularly. Food-safety decisions always belong to humans — check dates and
condition before consuming anything.

## Permissions

- `storage` — saves the inventory locally. Nothing leaves the browser.

## Files

- `manifest.json` — Manifest V3
- `popup.html` / `popup.css` / `popup.js` — the whole app (no content script needed)

Built for rdx's extension marathon. MV3, no remote code, no analytics.
