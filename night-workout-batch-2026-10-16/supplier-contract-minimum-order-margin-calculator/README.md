# MOQ Margin Calculator (v1.0.0)

Supplier-contract math for buyers: enter unit cost, MOQ, freight/fees, and
expected sell price to get:

- **Landed cost per unit** — (unit cost × MOQ + freight + fees) ÷ MOQ
- **Total outlay** — cash required to fulfill the contract
- **Break-even units** — units to cover total outlay at the sell price
- **Sell-through scenarios** — profit and margin at 100/75/50/25% sold

## Honest scope

- **Estimates only.** This is a calculator, not procurement or financial
  advice. Verify every quote with your supplier before committing.
- 100% local — inputs are saved in `chrome.storage.local` for convenience;
  nothing leaves your device, no network calls.

## Files

`manifest.json` (MV3), `popup.html`, `popup.css`, `popup.js`, icons.
Permissions: `storage` only (to remember your last inputs).
