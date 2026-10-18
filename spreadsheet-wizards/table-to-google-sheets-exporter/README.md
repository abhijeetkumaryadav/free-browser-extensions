# SheetsReady — Table to Google Sheets Exporter v1.0.0

Grab HTML tables from any page, or paste Markdown / CSV / TSV tables, clean
them up (trim cells, drop empty rows, header handling), then copy as TSV for
one-step pasting into Google Sheets or download import-ready CSV/TSV.

**Honest scope:** SheetsReady has no Google Sheets API integration and needs
no Google account. TSV pastes perfectly into Sheets with Ctrl/⌘+V, and the
CSV download works with Sheets' *File → Import*. Your data never leaves the
device.

## Features

- **Page table scan** — one click lists every `<table>` on the current tab
  (label, rows × columns); click a card to load it. Read-only, page untouched
- **Paste parsing** — Markdown tables (with `|---|---|` separator row) plus
  CSV/TSV/semicolon auto-detection with quoted-field support
- **Cleaning options** — trim whitespace, drop empty rows, first-row-as-header
  (persisted on-device)
- **Sheets-ready export** — Copy TSV (pastes straight into Sheets), Download
  CSV, Download TSV; proper quoting/escaping throughout
- **Import guide** — built-in 4-step "How to import" tab

## Install

**Chrome / Edge**
1. Unzip `table-to-google-sheets-exporter.zip`
2. Go to `chrome://extensions` (or `edge://extensions`), enable **Developer mode**
3. Click **Load unpacked** and select the unzipped folder

**Firefox**
1. Unzip the package
2. Go to `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on**
3. Select `manifest.json` (temporary installs don't persist across restarts)

## Permissions

- `activeTab` + `scripting` — read `<table>` elements on the tab you click
  "Scan" on; injection is on-demand only, never automatic
- `storage` — remembers cleaning preferences
- `downloads` — saves CSV/TSV when you click download

No host permissions beyond the active tab, no background page, no network.

## Publishing notes

- MV3, no deprecated APIs
- Single purpose, minimal justified permissions — suitable for the Chrome Web
  Store "Productivity" category
- Privacy: no data collection of any kind; include a matching privacy policy
  statement at listing time
