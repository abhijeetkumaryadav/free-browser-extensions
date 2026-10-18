# Zero-Stock Alert v1.0.0

Watch product pages for price drops and stock changes — honestly,
without background polling (service workers can't reliably monitor
pages, so detection happens when you browse).

- Hit **Watch page** on any product: saves its title, price, and
  availability text on-device.
- Whenever you open the popup on a watched page, it re-reads the
  page and flags: **▼ PRICE DROP**, **✔ BACK IN STOCK**,
  **● OUT OF STOCK**, or **▲ Price up**.
- **Update baseline** resets the saved snapshot to today's price.
- The watchlist shows every watched product with its saved price;
  open any page or remove it in one click.

## Try it
1. Unzip `zero-stock-alert-redirector.zip`.
2. Chrome/Edge: `chrome://extensions` → Developer mode → **Load unpacked** → select the folder.
3. Firefox: `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → select `manifest.json`.
4. Open a product page → **Watch page**. Revisit later → open the popup to see flags.

## Permissions
- `activeTab` + `scripting` — read the product page you choose to watch.
- `storage` — the watchlist lives on your device. Nothing is uploaded.

## Publishing notes
- MV3, zero network calls. Chrome Web Store: $5 one-time developer fee.
  Edge and Firefox accounts are free; Firefox add-ons must be signed.
