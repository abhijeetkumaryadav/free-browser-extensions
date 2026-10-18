# Data Broker Value Estimator

An **educational** browser extension that estimates what data brokers *might* pay for your data footprint each year.

## How it works

1. Answer 10 questions about your digital footprint (accounts, shopping, location sharing, apps…).
2. The extension multiplies your answers by a **bundled illustrative rate table** (approximate USD/year values).
3. You get an estimated annual total, a footprint tier, and a per-category breakdown.

## Honest scope

- The rate table is **illustrative reference data, not market prices**. Real broker pricing is opaque, varies wildly, and is mostly sold in bulk.
- This is an **awareness tool, not a real valuation**. It cannot know what any broker would actually pay for your profile.
- Answers and estimates are stored **only in your browser** (`chrome.storage.local`). Nothing is sent anywhere. There is no network code at all.

## Files

- `manifest.json` — Manifest V3, `storage` permission only
- `estimator.js` — pure estimation logic (unit-testable, no DOM)
- `popup.html` / `popup.css` / `popup.js` — 380px glassmorphism popup UI
- `icons/` — generated PNG icons

## Privacy

No data collection, no analytics, no remote requests.
