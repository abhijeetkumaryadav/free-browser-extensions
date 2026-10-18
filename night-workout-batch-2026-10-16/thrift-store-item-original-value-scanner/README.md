# ThriftValue — Thrift Find Logbook

A **manual** logbook for thrift-store finds. Log each item with what you paid and *your own* estimated original/retail value, then track total savings, per-item margins, and your whole collection.

## What it does

- **Log a find** — name, price paid, your estimated original price, category, store, and notes.
- **Live margin preview** — shows estimated savings and % off as you type.
- **Dashboard stats** — total saved, total paid, total estimated retail, find count.
- **Collection view** — sortable (newest, biggest savings, best margin %, highest paid) with per-item margins.
- **CSV export** — download your log for spreadsheets.
- **Clear all** — wipe everything with a confirmation.

## Honest scope (please read)

- "Original value" is **your estimate**, typed by you. The extension does **not** look up real prices — no product API exists for this, so there is no live price scan.
- All savings figures are only as accurate as your own guesses. Treat them as fun motivation, not appraisals.
- All data is stored in `chrome.storage.local` — 100% local, zero network calls.

## Install

1. Open `chrome://extensions`, enable **Developer mode**.
2. Click **Load unpacked** and select this folder.

## Permissions

- `storage` — keep your logged finds locally.

## Files

- `manifest.json` — MV3 manifest
- `popup.html` / `popup.css` / `popup.js` — 380px glassmorphism popup UI
- `icons/` — 16/48/128 PNG icons

No content scripts, no remote code, no tracking.
