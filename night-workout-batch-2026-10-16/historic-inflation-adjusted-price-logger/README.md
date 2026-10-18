# PriceLog — Inflation-Adjusted Price Logger

Log prices with dates and see them converted into today's money.

## What it does
- Log any price with an item name and date.
- Converts each price to current-money terms using a bundled CPI reference table.
- Dashboard: nominal total vs inflation-adjusted total, plus a nominal-vs-adjusted trend chart.
- Delete individual entries or clear the log.
- The CPI table is user-editable: correct any year and hit **Save table**; **Reset to defaults** restores the bundled values.

## Honest scope
- The CPI table is an **approximate reference** (US CPI-U annual averages, rounded; recent years are estimates), **not official figures**.
- Adjusted values are **estimates**, not financial advice.
- 100% local: all entries and table edits stay in `chrome.storage.local`. Nothing is sent anywhere.

## Files
`manifest.json` · `popup.html` · `popup.css` · `popup.js` · `README.md` · `icons/`

## Privacy
No permissions beyond `storage`. No network, no tracking.
