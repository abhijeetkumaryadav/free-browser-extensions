# Gatekeeper Fee Calculator v1.0.0

**What it does:** enter a sale price, cost of goods, shipping and ad
spend, pick a marketplace — and see the true take-home profit with every
fee itemized. Fees recalculate live as you type, and every fee value is
editable (marketplaces change their schedules; you stay in control).

**Presets included:** Amazon (US), eBay (US), Etsy, Walmart Marketplace,
Flipkart (IN), Shopify (own store). Optional fees (e.g. FBA fulfillment)
can be toggled on/off.

**Extras:** copyable text breakdown, saved scenario history (on-device),
reset-to-defaults button.

## Try it
1. Unzip `gatekeeper-fee-calculator.zip`.
2. Chrome/Edge: `chrome://extensions` → Developer mode → **Load unpacked**
   → select the folder.
   Firefox: `about:debugging#/runtime/this-firefox` → **Load Temporary
   Add-on** → select `manifest.json`.
3. Click the toolbar icon and type your numbers.

## Permissions
- `storage` — saves your fee edits, inputs and scenario history
  on-device. Nothing is uploaded, no network calls at all.

## Publishing notes
- Fee presets are static estimates, not live data. Add a disclaimer in
  the store listing: "Fee schedules change; verify against the
  marketplace's current published rates."
- Chrome Web Store: $5 one-time dev fee. Firefox Add-ons: free review.

## Files
```
manifest.json, popup.html/css/js, icons/, README.md
```

## Future-proofing
- Manifest V3 only. Fee presets live in one `MARKETPLACES` constant at
  the top of `popup.js`; user edits are stored as overrides in
  `chrome.storage.local` so defaults can be refreshed safely.
- Pure popup app — no content scripts, no host permissions, minimal
  review friction.
