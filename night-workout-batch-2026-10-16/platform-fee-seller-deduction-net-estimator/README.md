# Seller Fee Lens — Net Proceeds Estimator

Estimate what you keep after marketplace fees: pick a marketplace, enter sell
price, item cost, and shipping numbers, and get a net-proceeds estimate with a
line-by-line fee breakdown.

## Honest scope

- **Estimates only.** Fee tables ship with common marketplace defaults but they
  are *user-maintained* — tap "Edit fee tables" to change any rate. Always
  verify against the official marketplace fee pages before pricing.
- **Not financial advice.** This is an arithmetic helper, not tax, accounting,
  or business advice.
- **100% local.** Fee tables live in `chrome.storage.local`. No network calls,
  no accounts, no tracking.

## Features

- Editable per-marketplace fee tables (Amazon, eBay, Etsy, Shopify, Mercari, Custom)
- Per-sale inputs: sell price, item cost, shipping charged, shipping cost
- Net proceeds + margin %, with itemized fee breakdown
- One-click reset to default tables

## Install (developer mode)

1. Open `chrome://extensions`, enable **Developer mode**.
2. **Load unpacked** → select this folder.

## Files

- `manifest.json` — MV3 manifest (`storage` permission only)
- `popup.html` / `popup.css` / `popup.js` — popup UI + calculator logic
- `README.md` — this file
