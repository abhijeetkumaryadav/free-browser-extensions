# Gig Wage Converter — True Hourly Pay

A private calculator that converts gig earnings (per-delivery, per-ride, per-project) into your **true hourly wage** — accounting for active hours, unpaid wait time, out-of-pocket expenses, and mileage costs.

## What it does

- **Log shifts** — gig type, date, gross earnings, active hours, unpaid wait hours, miles driven, fuel & expenses, and a per-mile rate (defaults to a standard mileage rate you can edit).
- **True hourly wage** — `net ÷ (active + wait hours)`, where net = gross − expenses − (miles × mile rate). Shown for your latest shift and for any summary range.
- **Summaries** — Today / This week / All time: true $/hr, net earned, total paid hours, shift count.
- **Target comparison** — set a target $/hr and see instantly whether you're above or below it.
- **Shift history** — newest-first list with per-shift true wage and delete.
- **Clear all** — one-click wipe of all stored data.

## Honest scope

- This is a **calculator, not advice**. Results are **estimates** based on the numbers you enter.
- It does **not** account for taxes, insurance, depreciation beyond your mile rate, platform fees you didn't log, or tips paid outside the app.
- The default mile rate is a placeholder — replace it with your local standard mileage rate.
- Not tax, payroll, or financial advice. For filing or planning decisions, consult a professional.

## Privacy

- 100% local. All shifts and preferences live in `chrome.storage.local` on this device.
- **Zero network calls**, no accounts, no analytics.

## Files

| File | Purpose |
|---|---|
| `manifest.json` | MV3 manifest (`storage` permission only) |
| `popup.html` / `popup.css` | 380px deep-dark glassmorphism UI, single emerald accent |
| `popup.js` | Storage, wage math, summaries, history rendering |

## Install (developer mode)

1. Open `chrome://extensions`, enable **Developer mode**.
2. **Load unpacked** → select this folder (or install the `.zip` via your browser's extension installer).
3. Click the toolbar icon to open the converter.
