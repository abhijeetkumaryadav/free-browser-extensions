# ChunkTable — Large CSV Lazy Viewer

View huge CSV files instantly in your browser. ChunkTable parses files in 256 KB streaming chunks (quote-aware, RFC-4180-style) and renders only the rows currently visible — so even files with hundreds of thousands of rows stay smooth.

## Features

- **Chunked streaming parse** — reads the file in slices; UI shows live progress
- **Virtualized table** — only visible rows live in the DOM (~±6 row overscan)
- **Column search/filter** — filter across all columns or one selected column
- **Jump to row** — go straight to any row number in the current view
- **Header detection** — toggle "first row is header"
- **Stats** — row count, column count, live match count
- **100% on-device** — the file never leaves your machine

## Install

**Chrome / Edge:** unzip → `chrome://extensions` → Developer mode → Load unpacked → select the folder.
**Firefox:** `about:debugging` → This Firefox → Load Temporary Add-on → pick `manifest.json`.
**Opera:** `opera://extensions` → Developer mode → Load unpacked.

## Permissions

- `storage` — remembers your preferences (header toggle). No network access, no host permissions.

## Notes & limits

- Handles large files via chunked parsing, but extremely large files (multi-GB) are still bounded by available memory since rows are kept parsed in memory.
- Quote-aware parsing handles embedded commas, escaped quotes (`""`), and multi-line quoted fields.
- Only comma-delimited CSV is parsed; TSV files with commas will mis-parse (use the delimiter fixer extension first).
