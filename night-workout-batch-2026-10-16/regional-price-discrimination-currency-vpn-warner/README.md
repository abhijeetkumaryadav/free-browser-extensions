# Regional Price Gap Watcher (v1.0.0)

An informational price-awareness logbook. You log prices you personally
observe for the same product in different regions/currencies; the extension
converts them with a user-editable FX table and shows the gaps.

## What it is

- **Your observations only.** No network calls, no price fetching — every
  entry is typed by you.
- **Editable FX reference table** with approximate seed rates (not live data).
- **Gap reporting** per product: dollar and percentage difference between the
  cheapest and priciest logged region, plus a plain-language note that taxes,
  licensing, and local economics explain most gaps.

## What it is NOT

- **Educational awareness only.** It never advises, instructs, or assists in
  evading geo-blocking, VPN-based store switching, or violating store terms.
- Not a price-prediction or deal-finding service.

## Files

`manifest.json` (MV3), `popup.html`, `popup.css`, `popup.js`, icons.
Permissions: `storage` only (entries + FX table stay on your device).
