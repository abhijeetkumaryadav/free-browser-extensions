# Compare Cards — Personal Pros & Cons

A personal comparison-notes tool. Create comparison cards on any topic, add your
own pro/con bullets with weights, and get a net score from *your* weights.

## What it does

- **Comparison cards** on any topic ("Headphones A vs B", "City X vs City Y"…).
- Add **pro** and **con** bullets, each with a weight of **1–5** (how much it
  matters *to you*).
- Each card shows **Pros total / Cons total / Net** with a score bar and a
  verdict ("Leans positive", "Leans negative", "Even").
- Cards list shows each card's net score at a glance.
- **Rename** cards inline, **delete** bullets/cards, **export** everything as
  JSON or a plain-text summary.

## Honest scope

- **Your own notes — not researched data.** The extension has no browser/product
  database and fetches nothing. It cannot tell you which browser (or anything
  else) is "better" — it only totals the weights *you* assign.
- All data lives in `chrome.storage.local`. Nothing is transmitted anywhere.

## Files

- `manifest.json` — Manifest V3, `storage` permission only
- `popup.html` / `popup.css` / `popup.js` — UI + scoring engine
- `icons/` — generated PNG icons (16/48/128)

## Permissions

- `storage` — persist your comparison cards locally.
