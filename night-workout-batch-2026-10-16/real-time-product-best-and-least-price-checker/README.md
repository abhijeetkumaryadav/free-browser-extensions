# Price Logbook — Best & Least Price Tracker

A personal logbook for product prices you spot yourself. Log each sighting
with product name, store and price, then see the **best**, **least** and
**average** price per product with a small price-over-time chart.

## Honest scope

- **Your logged prices only — not live price comparison.** The extension
  cannot and does not fetch prices from other websites, scrape product
  pages, or compare live offers.
- Everything is stored locally in `chrome.storage.local`. No network
  requests, no accounts, no tracking.

## Use

1. Open the popup.
2. Enter product, store and price, then **Log price**.
3. Each product card shows Best / Least / Avg, a sparkline of logged
   prices, and the individual sightings (delete or clear as needed).

## Files

- `manifest.json` — Manifest V3, `storage` permission only
- `popup.html`, `popup.css`, `popup.js` — UI, styling, logbook logic
- `icons/` — generated PNG icons (16/48/128)

## Privacy

100% local. Nothing leaves your browser.
