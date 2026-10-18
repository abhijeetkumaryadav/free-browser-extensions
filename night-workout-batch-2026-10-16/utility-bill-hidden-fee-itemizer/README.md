# BillFee Itemizer — Hidden Fee Flag

A simple bill watchdog: log your utility bills line by line, get suspicious-sounding
fees flagged with plain-language explanations, and watch totals and averages over time.

## Honest scope (please read)

This extension is an **educational flagger**, not an official bill audit:

- Fees are flagged by matching common fee-sounding words (e.g. "convenience fee",
  "regulatory recovery", "miscellaneous"). It cannot know your contract, your
  provider's tariff, or whether a fee is legitimate for you.
- Everything you see comes from **data you type in yourself**. The extension has
  no access to your accounts, no network access, and makes no remote calls.
- If a fee looks wrong, call your provider — only they can confirm or remove it.

## Features

- Add bills (provider, billing month, line items with charge/fee/tax types)
- Automatic flagging of suspicious-sounding fees with plain-language explanations
- Dashboard: bill count, total paid, average per bill, flagged fee count
- Filter bills by provider
- Flagged-fees view with the reason for each flag
- Export everything to CSV
- Delete bills individually

## Permissions

- `storage` — saves your bills locally on this device. Nothing leaves the browser.

## Files

- `manifest.json` — Manifest V3
- `popup.html` / `popup.css` / `popup.js` — the whole app (no content script needed)

Built for rdx's extension marathon. MV3, no remote code, no analytics.
