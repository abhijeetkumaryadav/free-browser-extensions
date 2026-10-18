# Clear Sky Readiness — Astrophotography Journal

An astrophotography readiness **journal**: log nightly conditions and get a 0–100 readiness score from your own observations.

## What it does

- **Clear-sky factors guide** — plain-language explainer of cloud cover, moonlight, and transparency.
- **Log tonight** — rate cloud cover, moon interference, and transparency (each 0–4), add optional notes, save.
- **Readiness score** — weighted 0–100 score (cloud × 15, transparency × 8, moon × 5 penalties) with an Excellent / Good / Marginal / Poor verdict.
- **History** — newest-first log, average readiness, per-entry delete, clear-all with confirm.

## Honest scope

**Your logs — not a live forecast.** This extension fetches no sky data, weather APIs, or satellite imagery. It scores only the conditions you record. Cloud-cover charts and seeing forecasts must come from a real forecasting service.

## Permissions

- `storage` — your logs live in `chrome.storage.local`.

## Files

- `manifest.json` — MV3 manifest
- `popup.html` / `popup.css` / `popup.js` — UI; pure engine between `// ENGINE-START` / `// ENGINE-END`
- `README.md`, `icons/`

Fully local — zero network.
