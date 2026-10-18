# CsvJson — CSV to JSON Converter

Paste CSV, pick a delimiter (or auto-detect), preview the table, and convert it to JSON — as an array of objects (header row becomes the keys) or an array of arrays. Everything runs locally in your browser; your data never leaves the device.

## Features

- **Real CSV parsing:** quoted fields, escaped quotes (`""`), embedded newlines inside quotes, CR/LF line endings.
- **Delimiter:** auto-detect (comma / semicolon / tab / pipe) or choose manually.
- **Output shapes:** array of objects with header-row keys (duplicate headers get suffixed so no data is lost) or array of arrays.
- **Validation:** unterminated quotes and ragged rows (inconsistent column counts) are reported with row numbers.
- **Preview table:** first 10 rows, sticky header.
- **Stats:** row count, column count, detected delimiter.
- **Copy** to clipboard and **Download .json** (via blob — no `downloads` permission needed).
- **State persistence:** input, output and options restored next time you open the popup.

## Install (Chrome / Edge / Opera)

1. Unzip the `.zip` into a folder.
2. Go to `chrome://extensions`.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and select the folder.

## Install (Firefox)

1. Unzip the `.zip` into a folder.
2. Go to `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on…** and select `manifest.json` in the folder.

## Permissions

| Permission | Why |
|---|---|
| `storage` | Remembers your input, output and option settings between popup sessions. Nothing else. |

No network access, no content scripts, no data collection.

## Publishing notes

- Manifest V3, works in Chrome/Edge/Opera/Firefox.
- Single permission (`storage`), trivially reviewable.
- No remote code, no tracking, no analytics.
