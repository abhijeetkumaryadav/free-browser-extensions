# PivotLens — CSV Pivot Table Previewer (v1.0.0)

Paste CSV data and build interactive pivot tables right in the popup: pick a row field, column field, value field, and aggregation (sum / count / average / min / max). Renders the pivot with row totals, column totals, and a grand total, and exports the result as an Excel-compatible CSV.

100% on-device — your data never leaves the browser.

## Install

**Chrome / Edge**
1. Unzip `spreadsheet-pivot-table-previewer.zip`.
2. Go to `chrome://extensions` (or `edge://extensions`).
3. Enable **Developer mode** (top right).
4. Click **Load unpacked** and select the unzipped folder.

**Firefox**
1. Go to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on** and pick `manifest.json` from the unzipped folder.
   (Temporary: removed when Firefox restarts.)

## Permissions

- `storage` — remembers your last pasted CSV for convenience. Nothing is synced or sent anywhere.

## Publishing notes

- Manifest V3, no remote code, no network requests, no analytics.
- Minimal permission footprint (`storage` only); the single-file popup needs no host access.
- Screenshots for the store: show the sample-data pivot with totals.
