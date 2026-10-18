# Wholesale Invoice Generator v1.0.0

Create professional wholesale invoices right from the popup: seller
and buyer details, line items (product, qty, unit price, tax %),
automatic totals, and sequential invoice numbering. **Preview** opens
a clean printable invoice page — use the browser's Print dialog to
save as PDF. Save up to 50 named drafts and reload them anytime.

## Try it
1. Unzip `wholesale-invoice-generator.zip`.
2. `chrome://extensions` (or `edge://extensions`) → Developer mode → **Load unpacked** → select folder.
3. Fill in seller/buyer, add line items, click **Preview** → Print / Save PDF.
4. Firefox: `about:debugging` → This Firefox → Load Temporary Add-on → pick `manifest.json`.

## Permissions
- `storage` — saves your working invoice, drafts, and the invoice counter on-device. Nothing is uploaded.

## Publishing notes
- Chrome Web Store: $5 one-time developer fee, MV3, minimal permissions declared.
- No remote servers, no analytics, no tracking.
