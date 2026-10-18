# Scarcity Check — Flash-Sale Pressure Verifier

Scans flash-sale and product pages for **pressure tactics**: fabricated-looking stock counters, countdown timers, "only X left" claims, and urgency language — then scores overall pressure intensity.

## How it works

1. Click **Scan this sale page**.
2. The extension injects a one-time scanner into the active tab (explicit click only).
3. Visible text is checked against heuristic patterns:
   - **Stock-scarcity claims** — "only 3 left", "selling fast", "low stock", viewer counters ("12 people are watching").
   - **Countdown timers** — page elements that look like timers. Tip shown: reload later — if the timer resets or the deal continues, it was pressure theater.
   - **Urgency language** — "act now", "last chance", "ends tonight", etc.
4. A 0–100 pressure score with a Low / Moderate / High verdict, plus per-signal cards with plain-language explanations and the matched text.

The last scan is stored locally and restored when the popup reopens.

## Honest scope

- **Heuristic pattern detection only.** This extension flags suspicious *patterns* — it **cannot verify real inventory levels** and cannot prove a claim is fake.
- A high-pressure score means "this page uses a lot of pressure tactics", not "this sale is a scam".
- Read-only: the page is never modified. Zero network requests — 100% local.

## Permissions

- `storage` — remember the last scan.
- `activeTab` + `scripting` — inject the one-time scanner into the tab you click "scan" on.

## Files

- `manifest.json` — MV3 manifest.
- `popup.html` / `popup.css` / `popup.js` — popup UI; `scanSalePage()` is the injected scanner function.
- `icons/` — generated PNG icons.

## Development

Validation: `node --check` on `popup.js`, `manifest.json` JSON parse, icon sizes, ZIP root check.
