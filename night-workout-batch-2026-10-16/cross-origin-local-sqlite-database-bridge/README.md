# Scrape Export Bridge

Honest export bridge: extract structured data from the current page and export
CSV/JSON for import into your local database workflow.

## What it does

- **Sources:** HTML tables (first row → headers), lists, JSON-LD blocks, or any
  custom CSS selector — extracted from the active tab on your explicit click.
- **Preview:** first 50 rows in the popup, with row/column counts.
- **Exports:** one-click **CSV** (proper quoting) or **JSON** (array of objects)
  downloads via blob anchor.

## Honest scope

- **Export bridge only.** SQLite cannot run inside a browser extension, so this
  connects to nothing and stores nothing in a database. It produces files you
  import yourself.
- Extraction is heuristic (merged/nested tables are approximated).
- Scrape only data you have the right to use. Respect site terms and robots.txt.

## Import recipes

**sqlite3 (CSV):**
```
sqlite3 mydata.db
sqlite> .mode csv
sqlite> .import scrape-export.csv my_table
```

**pandas:**
```python
import pandas as pd
df = pd.read_csv("scrape-export.csv")
# or
df = pd.read_json("scrape-export.json")
```

## Permissions

- `storage` — remember your last source/selector choice.
- `activeTab` + `scripting` — inject the extractor into the current tab only
  when you click **Extract from this page**. No background page scraping.

## Files

- `manifest.json` — MV3 manifest
- `popup.html` / `popup.css` / `popup.js` — popup UI + export logic
- `content.js` — page extractor (injected on click only)
- `icons/` — generated PNG icons

100% local. Zero network.
