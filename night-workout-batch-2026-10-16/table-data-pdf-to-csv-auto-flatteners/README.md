# Table Flattener — Tabular Text to CSV

**Text-only. Does not parse PDF files.** Paste tabular text (or load a `.csv`/`.txt` file) and get a clean, normalized CSV back.

## What it does

- **Auto-detects the delimiter** — comma, tab, semicolon, or pipe — by scoring column-count consistency across the first 20 lines (override with the manual selector).
- **Parses quoted fields** RFC-4180 style (`"a, b"` stays one cell; `""` = literal quote).
- **Flattens rows** — trims every cell, drops fully-empty rows, pads short rows so every row has the same column count.
- **Previews** the clean table (first row treated as header when it looks like one).
- **Downloads** a tidy CSV (`<name>-flattened.csv`) or copies it to the clipboard.

## Honest limits

- No PDF parsing of any kind. The original extension name mentioned PDFs; real PDF table extraction is not feasible in a lightweight local extension, so this build is honestly scoped to text input.
- Header detection is a heuristic (first row, all non-numeric).

## Privacy

Everything runs locally in the popup. Nothing is uploaded or transmitted. Your last pasted text and delimiter choice are remembered locally via `chrome.storage.local`.

## Permissions

- `storage` — remember your last input and delimiter choice.
