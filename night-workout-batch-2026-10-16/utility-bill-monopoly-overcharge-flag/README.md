# Bill Overcharge Flag — Manual Bill Analyzer

Type in your utility bills; the extension compares them against a bundled,
user-editable reference-rate table and flags bills that look high, with
plain-language explanations of each flag.

## Honest scope (important)

- **Educational flagger only — NOT proof of overcharging.** Reference rates are
  approximate (US-ish national averages, illustrative); edit them to match your region.
- Flags describe how your typed bill compares to those references. Actual rates vary
  by tariff, season, provider, and region.
- 100% local: bills and rates in `chrome.storage.local`. No network, no accounts.

## Features

- Analyze: provider, utility type, month, usage, total, fixed fees → verdict
  (Looks high / Elevated / Within typical range) with per-flag explanations.
- Results history with verdict pills and per-bill delete.
- Reference-rate editor with reset-to-defaults.

## Permissions

- `storage` — save your bills and edited rates on this device.

## Files

- `manifest.json`, `popup.html`, `popup.css`, `popup.js`, `README.md`, `icons/`
