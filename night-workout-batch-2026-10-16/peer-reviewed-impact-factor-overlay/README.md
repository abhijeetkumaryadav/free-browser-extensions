# Journal Metric Logbook

> Scope, stated plainly: **this is a manual logbook.** There is no live journal-metrics API connected. Every number you see is one *you* researched and typed. It is a notebook, not a data feed.

## What it does

Keep your own ranked list of journals you read, cite, or submit to:

- **Log journals** with name, publisher, impact factor, SJR, acceptance rate, and free-form notes.
- **Rank & sort** by impact factor, SJR, name, or recency — ranks update as your numbers change.
- **Edit & update** — each card shows its last-updated date so you can track metric changes over time.
- **Export CSV** — download your logbook for spreadsheets or notes.

## What it does NOT do

- It does **not** fetch impact factors, SJR, or acceptance rates from anywhere.
- It does **not** validate that a number you typed is correct.
- Numbers may be stale or wrong if your research was — always re-check before citing or submitting.

## Privacy

Everything stays in `chrome.storage.local` on your machine. No network calls, no analytics, no accounts.

## Files

| File | Purpose |
|---|---|
| `manifest.json` | MV3 manifest (`storage` permission only) |
| `popup.html` / `popup.css` / `popup.js` | Logbook UI + logic |
| `icons/` | 16/48/128 PNG icons |

## Build / validation

- `node --check popup.js` — passes
- `manifest.json` parses as JSON, Manifest V3
- ZIP built with `manifest.json` at root

## Install (developer mode)

1. Open `chrome://extensions`, enable **Developer mode**.
2. **Load unpacked** → select this folder, or drag in the `.zip` release.
