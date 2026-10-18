# Variant Stock Checker v1.0.0

Scan a product page with size/color/style variants: reads
availability signals (disabled options, “sold out”/“out of stock”
text, struck-through or dimmed options, “only X left” notes) and
lists every variant as likely **in-stock / low / out-of-stock**
with the signal that produced the verdict. Estimates are
best-effort and clearly labeled.

## Try it
1. Unzip `variant-stock-checker.zip`.
2. `chrome://extensions` → Developer mode → **Load unpacked** → select folder.
3. Open a product page with variants → **Scan page**.

## Publishing notes
- Permissions: `activeTab` + `scripting` (read the page you scan),
  `storage` (nothing stored yet — reserved for future history). Nothing uploaded.
- Chrome Web Store: $5 one-time dev fee. Firefox: free, requires signing.
