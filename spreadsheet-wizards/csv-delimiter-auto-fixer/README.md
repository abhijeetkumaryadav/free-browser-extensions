# CSV Doctor — Delimiter Auto-Fixer v1.0.0

Paste or drop messy CSV text. CSV Doctor auto-detects the delimiter (comma,
semicolon, tab, or pipe) with a heuristic consistency score, previews the
parsed table, flags ragged rows with per-row warnings, and exports a clean,
correctly quoted CSV (RFC 4180) in the delimiter of your choice.

## Features

- **Auto delimiter detection** — scores `,` `;` TAB `|` by column-count
  consistency across the first 25 lines; manual override dropdown included
- **Proper CSV parsing** — quoted fields, escaped `""` quotes, embedded
  newlines handled per RFC 4180
- **Ragged-row warnings** — rows whose field count differs from the header
  are highlighted and listed with actionable hints
- **Clean export** — converts to comma / semicolon / tab / pipe with correct
  quoting and escaping; download via `chrome.downloads` or copy to clipboard
- **Live preview** — first 8 rows rendered as a table; stats for rows,
  columns, and ragged rows
- **100% on-device** — no network calls, no analytics, nothing leaves the
  browser

## Install

**Chrome / Edge**
1. Unzip `csv-delimiter-auto-fixer.zip`
2. Go to `chrome://extensions` (or `edge://extensions`), enable **Developer mode**
3. Click **Load unpacked** and select the unzipped folder

**Firefox**
1. Unzip the package
2. Go to `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on**
3. Select `manifest.json` (temporary installs don't persist across restarts)

## Permissions

- `storage` — remembers your last-used export delimiter
- `downloads` — saves the cleaned CSV when you click Download

No host permissions, no content scripts, no remote code.

## Publishing notes

- MV3, no deprecated APIs
- Single purpose, minimal permissions — suitable for the Chrome Web Store
  "Productivity" category
- Privacy: no data collection of any kind; include a matching privacy policy
  statement at listing time
