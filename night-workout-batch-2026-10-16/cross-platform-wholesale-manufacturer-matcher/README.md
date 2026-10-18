# Supplier Book

Your own supplier/manufacturer contact book with search and a comparison matrix — **not** a live directory.

## What it does

- **Add suppliers** — name, platform, product, unit price, MOQ, contact, notes.
- **Search** — instant multi-field search with prefix-first ranking.
- **Comparison matrix** — entries are grouped by product so you can compare suppliers side-by-side on price, MOQ, and platform.
- **Dashboard** — supplier, product, and platform counts.

## Honest scope (read the label in the popup)

This is your own contact book. No supplier APIs exist for an extension to query, so there is no live directory, no automatic matching, and no price discovery — every entry is typed by you.

## Privacy

100% local. All data lives in `chrome.storage.local`. Zero network requests.

## Permissions

- `storage` — persist your supplier entries.

## Install

1. Open `chrome://extensions`, enable Developer mode.
2. "Load unpacked" → select this folder.

## Files

- `manifest.json` — MV3 manifest
- `popup.html` / `popup.css` / `popup.js` — UI, search, matrix logic
- `icons/` — generated PNG icons
