# FlatSheet — JSON to Excel Flattener (v1.0.0)

Paste any JSON — an object, an array of objects, or deeply nested data — and flatten it into a spreadsheet-style table. Nested objects become dot-notation columns (`address.city`), arrays expand by index (`tags.0`), and the union of all keys becomes the column set. Preview the table, then download an Excel-compatible CSV (UTF-8 with BOM) or copy as TSV for pasting into Sheets/Excel.

100% on-device — your data never leaves the browser. Best-effort flattening is clearly labeled in the UI.

## Install

**Chrome / Edge**
1. Unzip `json-payload-to-excel-sheet-flattened.zip`.
2. Go to `chrome://extensions` (or `edge://extensions`).
3. Enable **Developer mode** (top right).
4. Click **Load unpacked** and select the unzipped folder.

**Firefox**
1. Go to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on** and pick `manifest.json` from the unzipped folder.
   (Temporary: removed when Firefox restarts.)

## Permissions

- `storage` — remembers your last pasted JSON for convenience. Nothing is synced or sent anywhere.

## Publishing notes

- Manifest V3, no remote code, no network requests, no analytics.
- Minimal permission footprint (`storage` only); the single-file popup needs no host access.
- Screenshots for the store: show the sample JSON flattened with dot-notation columns.
