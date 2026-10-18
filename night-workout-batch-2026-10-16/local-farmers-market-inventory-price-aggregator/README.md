# Farm Market Price Log — Manual Produce Price Aggregator

A manual price logbook for farmers-market shoppers. You type in the prices you see at
each market/stall; the extension aggregates them into average prices per item across
markets, highlights the cheapest market, and draws a price trend.

## Honest scope (important)

- **Your logged prices only — NOT live market data.** There is no API for farmers-market
  prices; every number in the app is typed by you.
- Averages and "best" labels describe your own logs, not the market at large.
- 100% local: all data in `chrome.storage.local`. No network calls, no accounts.

## Features

- Log tab: item, price, unit, market, stall, date.
- Compare tab: per-item market averages with best-price highlight, entry counts,
  low prices, and an average-per-visit price trend.
- Entries tab: search, per-entry delete, clear-all.
- No content script — the popup is the whole app.

## Permissions

- `storage` — save your price entries on this device.

## Files

- `manifest.json`, `popup.html`, `popup.css`, `popup.js`, `README.md`, `icons/`
