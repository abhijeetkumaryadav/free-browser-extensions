# FeeLens — Checkout Fee Itemizer

On-demand scan of the visible checkout/order-summary area that itemizes fees and flags hidden convenience charges.

## What it does
- Click **Scan this checkout page** → a content script (injected on explicit click only) finds the order-summary region using common summary selectors, extracts label/amount text pairs, and classifies each as subtotal, fee, tax, total, or other.
- Dashboard: subtotal / fees found / taxes / total tiles.
- Flags fee-like line items (convenience fees, service fees, processing charges, booking fees, surcharges, pre-selected add-ons, pre-filled tips…) with a plain-language explanation per flag.
- Persists only the last scan's summary (count, fee total), nothing else.

## Honest scope
- **Heuristic scan of the visible page only.** It reads what the checkout displays — it cannot verify the merchant's math or see fees revealed later in the flow.
- **Read-only:** the page is never modified.
- Keyword patterns are deliberately broad and can misfire; flags are informational, not accusations.

## Files
`manifest.json` · `popup.html` · `popup.css` · `popup.js` (injects a self-contained scan function) · `README.md` · `icons/`

## Permissions
`storage` (last-scan summary only), `activeTab` + `scripting` (on-demand injection on your click). No network.
