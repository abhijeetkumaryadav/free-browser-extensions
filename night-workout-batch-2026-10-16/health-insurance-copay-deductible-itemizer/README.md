# Cost Tracker — Healthcare Payment Itemizer

A personal healthcare payment logbook.

## What it does

- **Log payments** with date, provider, type (copay / deductible / premium / other), and amount
- **Totals by type** — see where your money goes at a glance
- **Deductible progress bar** — set your own annual deductible target and watch your logged deductible payments fill the bar
- **History** with per-entry delete, clear-all, all stored in `chrome.storage.local`

## Honest scope

- **Your records — not insurance advice.** This extension only stores what *you* type.
- It cannot see your insurer's official totals, deductible, or claims. Always check your insurer's records for official numbers.
- 100% local, zero network, one permission (`storage`).

## Files

`manifest.json`, `popup.html`, `popup.css`, `popup.js`, `icons/`, `README.md`

## Install (developer mode)

1. Open `chrome://extensions`, enable **Developer mode**
2. **Load unpacked** → select this folder
3. Pin the extension and log payments
