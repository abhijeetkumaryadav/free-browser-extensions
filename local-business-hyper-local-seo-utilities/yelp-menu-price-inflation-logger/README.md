# Menu Price Log — Inflation Tracker v1.0.0

Log restaurant **menu item prices over time** and watch inflation per item. See per-item price history charts, inflation % versus the first logged price, biggest movers per restaurant, and export everything to CSV.

## What it does

- **Restaurants tab** — add restaurants, then menu items with optional categories.
- **Log price tab** — record a price for an item with a date (defaults to today).
- **Report tab** — per restaurant: biggest movers, and per item the current price, inflation % vs first logged price, a sparkline chart, full entry history with per-entry delete, and CSV export.

Inflation is computed as `(last − first) / first × 100` on your own logged entries.

**Honest scope:** this is a manual price log. It never scrapes Yelp, never reads any menu site, and never sends data anywhere.

## Install

**Chrome / Edge**
1. Unzip `yelp-menu-price-inflation-logger.zip`.
2. Open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

**Firefox**
1. Open `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on**.
2. Select `manifest.json` inside the unzipped folder. (Temporary installs reset on browser restart.)

**Opera**
1. Open `opera://extensions`, enable **Developer mode**.
2. Click **Load unpacked** and select the unzipped folder.

## Permissions

| Permission | Why |
|---|---|
| `storage` | Save your restaurants, items, and prices on this device only. |

No host permissions, no network access.

## Publishing notes

- MV3 only, no deprecated APIs.
- Privacy policy can state: collects nothing, transmits nothing; all data stays in local extension storage.
- Screenshots: show the Log price tab and the Report tab with a sparkline chart.
