# BibTeX Collector — Local .bib Manager

A **fully local** BibTeX entry manager. Add, validate, de-duplicate, search,
import, and export `.bib` entries — everything is stored in
`chrome.storage.local` and nothing leaves your device.

## Features

- Add entries: type (`article`, `book`, `inproceedings`, …), citation key,
  title, author, year, journal/venue, plus free-form extra fields
  (`field = value`, one per line)
- **Validation:** key required, key character set (`A–Z a–z 0–9 : . _ + - /`),
  **duplicate-key detection** (case-insensitive), year range, unknown types
- **Export** the whole library as `library.bib`; **copy** a single entry's
  `.bib`; **import** an existing `.bib` file (basic parser: braces/quotes,
  nested braces, unknown types skipped with a report)
- Search across key/title/author/all fields; per-entry delete

## Permissions

`storage` only. Zero network calls.

## Install (development)

1. Open `chrome://extensions`, enable **Developer mode**
2. **Load unpacked** → select this folder
3. Click the toolbar icon to open the popup
