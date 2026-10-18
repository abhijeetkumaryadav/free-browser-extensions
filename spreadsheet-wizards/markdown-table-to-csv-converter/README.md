# Tablix — Markdown Table to CSV (v1.0.0)

Paste Markdown containing one or more tables. Tablix detects every table —
alignment rows (`| --- |`, `:---:`, `---:`), escaped pipes (`\|`), and inline
code are all handled — then shows a preview and lets you copy or download each
table as CSV with your choice of delimiter. All on-device.

## Install

**Chrome / Edge**
1. Unzip `markdown-table-to-csv-converter.zip`.
2. Open `chrome://extensions` (or `edge://extensions`).
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the unzipped folder.

**Firefox**
1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on** and select `manifest.json`.
   (Temporary install — removed on browser restart, as with all unsigned add-ons.)

## Permissions

- `storage` — remembers your chosen CSV delimiter between sessions.
  Your pasted Markdown is **never** stored or transmitted; it lives only in the popup.

## How it works

1. Paste Markdown (or load the sample) and click **Detect tables**.
2. Detection rule: a line starting with `|` followed by a separator row
   (`| --- |`, with optional `:` alignment markers) opens a table; consecutive
   `|`-leading lines are its rows. Escaped pipes (`\|`) stay inside their cell.
3. Each detected table gets a preview card with row/column counts.
4. Choose the CSV delimiter (comma / semicolon / tab / pipe), then **Copy CSV**
   or **Download CSV** per table. Multiple tables in one paste are all detected.

## Publishing notes

- Manifest V3, no remote code, no network calls, no content scripts.
- Icons are locally generated PNGs (16/48/128).
- Chrome Web Store: single-purpose, minimal `storage` permission — straightforward review.
