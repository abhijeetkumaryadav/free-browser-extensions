# Freight Cost Estimator

Estimate domestic (US) parcel freight costs across UPS, FedEx, and USPS —
dimensional weight, zone-based pricing, fuel surcharges, and accessorial fees —
all computed **on-device** with no network calls.

## Install (Chrome / Edge)

1. Open `chrome://extensions` (Edge: `edge://extensions`).
2. Enable **Developer mode** (top-right toggle).
3. Click **Load unpacked** and select this folder.
4. Pin the extension from the toolbar for quick access.

## Install (Firefox)

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on** and select `manifest.json`.
3. Note: temporary installs are removed when Firefox restarts.

## How it works

1. Enter origin/destination ZIP codes, weight (lbs), and dimensions (inches).
2. Pick a service speed: **Economy**, **Ground**, or **Express**.
3. Toggle residential delivery / signature if needed.
4. Get side-by-side estimates for UPS, FedEx, and USPS, cheapest highlighted.

The estimator computes:

- **Zone (2–8)** from ZIP-code separation (heuristic).
- **Dimensional weight** = L×W×H ÷ 139, billable = max(actual, dim).
- **Line-haul** from built-in per-carrier rate models, scaled by zone.
- **Fuel surcharge** (14.5%), plus flat fees for residential ($5.10),
  signature ($6.85), and oversize handling ($32.50).

Your last inputs and up to 10 estimates are saved locally via
`chrome.storage.local` so you can recall them between sessions.

## Permissions

| Permission | Why it's needed |
|------------|-----------------|
| `storage`  | Save your form inputs and estimate history on this device only. |

No other permissions are requested. No data ever leaves your device —
there are no network requests, accounts, or analytics.

## Important: estimates, not quotes

Rate models are simplified approximations for budgeting and comparison.
Real carrier quotes depend on live rates, exact zones, negotiated discounts,
and service rules — always confirm with the carrier before quoting a customer.

## Publishing notes

- **Chrome Web Store:** single purpose (shipping-cost estimation), minimal
  `storage` permission, no remote code, no data collection → fits the
  "single purpose" and data-disclosure policies. Declare no data collection
  in the Privacy tab.
- **Firefox Add-ons:** same single-purpose story; `storage` is a standard
  low-risk permission.
