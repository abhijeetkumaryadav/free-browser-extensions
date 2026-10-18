# ColumnClean — CSV Column Data Standardizer

Paste CSV data and clean one column at a time with a live before/after
preview: trim whitespace, normalize case (upper/lower/title), normalize
dates (auto-detects common formats, 4 output formats, day-first toggle),
normalize numbers/currency (handles `$1,234.50` and European `1.234,56`
styles), and remove duplicate rows by the selected column.

## Install (unpacked)

**Chrome / Edge**
1. Unzip the release archive.
2. Go to `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
3. Click **Load unpacked** and select the folder.

**Firefox**
1. Go to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…** and select `manifest.json`.

## Permissions

- `storage` — persists your pasted CSV draft between popup opens. Nothing leaves your device.

## Privacy

All parsing and transformations run 100% on-device. CSV export uses a
local blob download (no `downloads` permission needed). No network calls,
no analytics, no remote code.

## Publishing notes

- Manifest V3, no deprecated APIs.
- Minimal permission set (`storage` only) with in-README justification.
- All assets (icons) generated locally; no remote fonts or scripts.
