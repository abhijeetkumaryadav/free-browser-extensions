# Order Fulfillment Automator v1.0.0

Import an orders CSV (`order_id, customer, items, address`) and work
each order through a **pick → pack → ship** checklist — tap the
status pill to advance it. Live stats (orders / picked / packed /
shipped) plus a shipped-progress bar. Every order has a **Slip**
button that opens a clean, printable packing slip (with pick
checkboxes) in a new tab.

## Try it
1. Unzip `order-fulfillment-automator.zip`.
2. `chrome://extensions` → Developer mode → **Load unpacked** → select folder.
3. Click the icon → Import CSV → work the checklist.

## Publishing notes
- Permissions: `storage` only (orders on-device). Nothing uploaded.
- Chrome Web Store: $5 one-time dev fee.

## Files
```
manifest.json, popup.html/css/js, slip.html/js (packing slip page), icons/, README.md
```
