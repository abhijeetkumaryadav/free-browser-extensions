# DedupeIQ — Fuzzy Duplicate Row Finder (v1.0.0)

Paste CSV data, pick key columns, and find exact + fuzzy duplicate rows using
Levenshtein similarity with an adjustable threshold. Review each duplicate group,
choose which rows to keep, then export a deduped CSV — all on-device.

## Install

**Chrome / Edge**
1. Unzip `duplicate-row-fuzzy-match-finder.zip`.
2. Open `chrome://extensions` (or `edge://extensions`).
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the unzipped folder.

**Firefox**
1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on** and select `manifest.json`.
   (Temporary install — removed on browser restart, as with all unsigned add-ons.)

## Permissions

- `storage` — remembers your match settings (threshold, toggles) between sessions.
  Your pasted CSV data is **never** stored or transmitted; it lives only in the popup.

## How it works

1. Paste CSV (first row = header; quoted fields supported) or load the sample.
2. Toggle which columns are match keys, set the fuzzy threshold (50–100%).
3. Click **Find duplicates** — rows are grouped by exact key match or
   Levenshtein similarity ≥ threshold (case-insensitive and whitespace options).
4. Each group shows per-row match scores (EXACT / % match). Check the rows to keep
   (defaults to the first per group).
5. **Export deduped CSV** downloads the kept rows; **Copy** copies them to the clipboard.

Matching is heuristic — always review groups before exporting.

## Publishing notes

- Manifest V3, no remote code, no network calls, no content scripts.
- Icons are locally generated PNGs (16/48/128).
- Chrome Web Store: single-purpose, minimal `storage` permission — straightforward review.
