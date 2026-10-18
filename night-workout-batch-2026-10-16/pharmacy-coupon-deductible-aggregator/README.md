# Pharmacy Price Log

A personal logbook for pharmacy price quotes you receive yourself. Log each
quoted price with medication, pharmacy and date, see the **cheapest quote per
medication**, and track your deductible spend against a target you set
manually.

## Honest scope — read carefully

- **Personal logbook only.** You enter prices you were quoted; the extension
  never fetches live coupon data or aggregates external coupons.
- **NOT medical advice.** This tool does not recommend, compare efficacy of,
  or suggest any medication. It is a price notebook.
- Everything is stored locally in `chrome.storage.local`. No network
  requests, no accounts, no tracking.

## Use

1. **Deductible tracker** — optionally set your deductible target; quotes
   flagged "counts toward deductible" feed the progress bar.
2. **Log a price quote** — medication, pharmacy, price, and whether it
   counts toward the deductible.
3. Each medication card shows the cheapest quote and the individual quotes
   (delete or clear as needed).

## Files

- `manifest.json` — Manifest V3, `storage` permission only
- `popup.html`, `popup.css`, `popup.js` — UI, styling, logbook logic
- `icons/` — generated PNG icons (16/48/128)

## Privacy

100% local. Nothing leaves your browser.
