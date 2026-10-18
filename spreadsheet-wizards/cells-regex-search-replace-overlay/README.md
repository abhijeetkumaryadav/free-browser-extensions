# RegexFind — Regex Find & Replace for Tables

Regex-powered find & replace across pasted CSV or TSV data. Live match highlighting, capture-group replacements (`$1`, `$2`…), per-column or whole-table scope, before/after preview, and CSV download — all 100% on-device.

## Features

- **Paste CSV/TSV** — auto-detects comma, tab, semicolon, or pipe delimiters; honors quoted fields
- **Live regex validation** — invalid patterns show the exact error, never crash the preview
- **Flags** — `g` (global), `i` (case-insensitive), `m` (multiline); global is always on for counting
- **Capture groups** — use `$1`, `$2`, `$&`, `$`` in the replacement, e.g. find `(\d{3})-(\d{3})-(\d{4})` → replace `$1.$2.$3`
- **Scope** — whole table or a single column (header names picked up automatically)
- **Before/After preview** — matches highlighted in amber; changed cells marked in the After view
- **Match stats** — total matches + cells affected, updating as you type
- **Apply / Download / Copy** — apply replacements back into the editor, or export as CSV
- **Cheat-sheet** — quick regex reference built into the popup
- **Pattern memory** — your last pattern, flags, and replacement are restored on reopen

## Install

**Chrome / Edge**
1. Download and unzip `cells-regex-search-replace-overlay.zip`
2. Open `chrome://extensions` (or `edge://extensions`)
3. Enable **Developer mode**
4. Click **Load unpacked** and select the unzipped folder

**Firefox**
1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on** and select `manifest.json`

The extension works identically in any Chromium or Firefox browser.

## Permissions

| Permission | Why |
|---|---|
| `storage` | Remembers your last regex pattern, flags, and replacement between sessions |

No host permissions, no content scripts, no network access. Your data never leaves the browser.

## Publishing notes

- Manifest V3, no remote code, no external libraries
- All processing is local; the store privacy questionnaire can state "no data collected"
- Screenshots: paste the sample data, type a phone-number regex, show the Before/After preview

## Example

Find: `\((\d{3})\)\s?(\d{3})-(\d{4})` → Replace: `$1-$2-$3`

turns `(555) 123-4567` into `555-123-4567` across every in-scope cell.
