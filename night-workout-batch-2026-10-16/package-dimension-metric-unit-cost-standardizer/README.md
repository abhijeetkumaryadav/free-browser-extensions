# Parcel Metrics — Dimension & Unit Cost Standardizer

Convert package dimensions (inches ⇄ cm) and weights (lb ⇄ kg), compute
dimensional (volumetric) weight with your own divisor setting, find the billable
weight, and standardize a shipping quote into cost per billable pound and cost
per unit.

## Honest scope

- **Calculator only.** Length/weight conversions are exact math.
- The **dim-weight divisor is your setting** (common examples: 139 US domestic
  air, 194 international, 5000 for cm³→kg). Carriers publish their own factors —
  verify your carrier's rules before quoting customers.
- **100% local.** Last inputs are stored in `chrome.storage.local`. No page
  interaction, no network calls, no accounts.

## Install (developer mode)

1. Open `chrome://extensions`, enable **Developer mode**.
2. **Load unpacked** → select this folder.

## Files

- `manifest.json` — MV3 manifest (`storage` permission only)
- `popup.html` / `popup.css` / `popup.js` — popup UI + conversion logic
- `README.md` — this file
