# Unit Price Standardizer v1.0.0

Scan any product page: detects the price and the pack size
(500g, 2L, pack of 12…) and shows fair standardized unit prices —
per 100g / per kg / per liter / per piece. Includes a manual
compare box so two differently-sized listings can be compared
side by side. All parsing is best-effort and clearly labeled.

## Try it
1. Unzip `unit-price-standardizer.zip`.
2. `chrome://extensions` → Developer mode → **Load unpacked** → select folder.
3. Open a product page → **Scan page**. Enter another listing's
   price + quantity in the compare box to see which is cheaper per unit.

## Publishing notes
- Permissions: `activeTab` + `scripting` (read the page you scan),
  `storage` (nothing stored yet — reserved for future history). Nothing uploaded.
- Chrome Web Store: $5 one-time dev fee. Firefox: free, requires signing.
