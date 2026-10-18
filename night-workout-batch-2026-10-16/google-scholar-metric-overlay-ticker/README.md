# Scholar Metric Log — Citation Tracker

A **personal log** of your papers' metrics. Save papers with citation counts,
h-index context notes, and open Google Scholar searches per title — everything
is manual and stored locally in `chrome.storage.local`.

**Honest scope:** This is your log — **not live metrics**. There is no Google
Scholar scraping, no API calls, no network traffic at all. Citation counts are
whatever you enter yourself.

## Features

- Add papers: title, authors, year, citations, free-text notes
- Per-paper "Google Scholar ↗" button opens a Scholar search in a new tab
- Case-insensitive search across title/authors/notes
- Header stats: paper count, total citations, year range
- Per-paper delete; Export JSON backup

## Validation

- Year must be 1800–2100 (or blank); citations must be a non-negative integer
- 500-paper cap; all text trimmed and length-capped

## Permissions

`storage` only. Zero network calls.

## Install (development)

1. Open `chrome://extensions`, enable **Developer mode**
2. **Load unpacked** → select this folder
3. Click the toolbar icon to open the popup
