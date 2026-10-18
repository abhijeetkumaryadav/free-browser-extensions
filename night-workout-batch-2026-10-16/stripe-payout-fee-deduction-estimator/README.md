# Stripe Payout Fee Estimator

Estimate Stripe transaction fees and net payout totals from transaction amounts you enter.

## Honest scope

- **Estimate only.** Real Stripe fees depend on your plan, country, currency, and payment method.
- Defaults: standard US card-not-present rates — **2.9% + $0.30 per transaction**. Both are editable.
- 100% local: `chrome.storage.local` only. Zero network. No remote libraries.

## Features

- Editable fee rate % and fixed per-transaction fee
- Paste amounts — one per line or comma-separated; junk lines ignored
- Results: gross total, total fees, net payout, transaction count, effective fee %
- Save estimates (last 20) with delete

## Math check

3 transactions of $100 at 2.9% + $0.30 → gross $300.00, fees $9.60, net $290.40.

## Files

- `manifest.json` — Manifest V3
- `popup.html` / `popup.css` / `popup.js` — UI and logic
- `README.md` — this file
- `icons/` — 16/48/128 PNG icons

## Install

Load as an unpacked extension in Chrome/Edge (Developer mode → Load unpacked), or install the `.zip` in Firefox via `about:addons` → Install Add-on From File after signing.
