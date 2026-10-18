# Yield Payout Estimator v1.0.0

Estimate creator and affiliate payouts, all on-device.

- Enter **sales revenue**, **number of sales**, **base rate %**, and
  **returns / chargebacks %** → estimated **net payout**, gross
  commission, returns deduction, average payout per sale, and the
  effective commission rate.
- **Marginal commission tiers**: define revenue bands with their own
  rates (e.g. 8% on the first $5k, 12% on the next $15k); each band
  earns its own rate. Tiers persist on-device; clear them to fall back
  to the flat base rate.
- **What-if rate slider**: drag to see how a different flat rate would
  change the payout at the same revenue and returns.

## Try it
1. Unzip `yield-payout-estimator.zip`.
2. Chrome/Edge: `chrome://extensions` → Developer mode → **Load unpacked** → select the folder.
3. Firefox: `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → select `manifest.json`.
4. Click the icon, enter your numbers.

## Permissions
- `storage` — saves your inputs and tier table locally. Nothing is uploaded.

## Publishing notes
- MV3, zero network calls. Chrome Web Store: $5 one-time developer fee.
  Edge and Firefox accounts are free; Firefox add-ons must be signed.
