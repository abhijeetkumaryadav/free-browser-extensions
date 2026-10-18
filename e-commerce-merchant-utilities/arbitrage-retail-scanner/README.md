# Arbitrage Retail Scanner v1.0.0

**Scan page** on any product page: detects the title and price
(JSON-LD → meta tags → price patterns), then offers one-click
comparison searches on Google Shopping, Amazon, and eBay.

The **margin calculator** takes buy price, sell price, marketplace fee
% and shipping, and shows profit, margin, ROI plus a verdict badge
(STRONG / DECENT / THIN / LOSS). Save scans to history for later.

## Try it
1. Unzip `arbitrage-retail-scanner.zip`.
2. `chrome://extensions` → Developer mode → **Load unpacked** → select folder.
3. Open any product page → click the icon → **Scan page**.

## Publishing notes
- Permissions: `activeTab` + `scripting` (read the page you scan),
  `storage` (scan history on-device). Nothing uploaded.
- Chrome Web Store: $5 one-time dev fee.

## Files
```
manifest.json, popup.html/css/js, icons/, README.md
```
