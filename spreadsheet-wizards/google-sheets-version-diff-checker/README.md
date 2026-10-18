# SnapDiff — Sheets Snapshot Diff Checker

Compare two CSV snapshots (e.g. Google Sheets exports taken at different times) and see exactly what changed: added rows, removed rows, and changed rows with cell-level before → after highlighting.

## Features

- **Paste two CSV snapshots** — before and after, quote-aware parsing
- **Key-column matching** — pick the column that identifies each row (e.g. ID, SKU, email)
- **Cell-level diffs** — changed rows show old → new per cell
- **Summary counts** — added / removed / changed totals, duplicate-key warnings
- **Filters** — toggle added/removed/changed categories
- **Export diff CSV** — full change report for sharing
- **Inputs remembered** — snapshots persist locally between popup opens
- **100% on-device** — no Sheets API, no account access, no network

## How to snapshot from Google Sheets

File → Download → Comma-separated values (.csv), paste the contents into Before, repeat later for After.

## Install

**Chrome / Edge:** unzip → `chrome://extensions` → Developer mode → Load unpacked → select the folder.
**Firefox:** `about:debugging` → This Firefox → Load Temporary Add-on → pick `manifest.json`.
**Opera:** `opera://extensions` → Developer mode → Load unpacked.

## Permissions

- `storage` — remembers your pasted snapshots locally. No network access, no host permissions.

## Notes & limits

- Matching is by exact key value (optional case-insensitive mode); rows without a matching key are reported as added/removed.
- Duplicate keys within one snapshot are flagged and only the first occurrence is compared.
- This is a manual-snapshot tool, not a live Google Sheets integration — the Sheets API requires OAuth and is out of scope.
