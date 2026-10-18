# Competitor Pricing Tier Change Alert

Manually track competitor pricing tiers over time. You log pricing snapshots (tier names + prices with dates); the extension diffs each new snapshot against the previous one and keeps a per-competitor price history.

## Honest scope

- **Manual logging only.** This extension does NOT monitor competitors, scrape websites, or fetch live prices. Every price is typed by you.
- Change detection compares *your* consecutive logs. It cannot tell you what happened between two logs you never recorded.
- 100% local — all data stays in `chrome.storage.local`. No network requests, ever.

## Features

- **Competitors**: add/remove competitors (deleting one removes its snapshots too).
- **Log**: pick a competitor, set a snapshot date, enter tiers + prices. Saving runs a diff against the previous snapshot with a change list: price UP / DOWN / new tier / removed tier.
- **History**: snapshot count, current tier count, total changes logged, plus every snapshot's tier/price table.

## How to use

1. Add a competitor in the Competitors tab.
2. In the Log tab, enter that competitor's current tiers and prices, then **Save snapshot & check changes**.
3. Later, log again — the diff box shows what changed since last time.

## Files

- `manifest.json` — MV3, `storage` permission only
- `popup.html` / `popup.css` / `popup.js`
- `icons/` — 16/48/128 PNGs (generated)

## Compatibility

Chrome / Edge / Opera (Manifest V3). Firefox-compatible with `browser` polyfill adjustments.
