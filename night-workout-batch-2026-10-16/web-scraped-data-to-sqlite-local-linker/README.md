# Scrape Export Bridge

An honest take on "scraped data → local database": **SQLite cannot run inside a browser extension**, so this tool scrapes structured data from the current page and exports it as **CSV or JSON** — a bridge you can import into your own database workflow (`sqlite3`, Excel, Python, …).

## What it does

- **Scan presets** — Tables (header + rows), Lists (each item as a row), JSON-LD structured data (flattened to field/value pairs), or any **custom CSS selector**
- **Live preview** — first 50 rows with union headers across mixed sources
- **One-click export** — Download CSV (proper quoting) or Download JSON (array of objects)
- **Read-only** — the page is never modified; zero network calls

## Importing into SQLite yourself

```bash
sqlite3 mydb.db ".mode csv" ".import scrape-*.csv pages"
```

or with Python: `pandas.read_csv(...)` → `to_sql(...)`.

## Honest scope

- Export bridge only — **no SQLite involved, nothing connects to a database**.
- Extraction is heuristic: merged-cell or heavily nested tables export approximately; always eyeball the preview.
- Respect site terms and robots.txt; scrape only data you have the right to use.

## Permissions

- `storage` — small usage (no bulk data stored)
- `activeTab` — scan the current tab only
- `scripting` — inject the extractor on click

## Files

`manifest.json` (MV3) · `popup.html/css/js` · `content.js` (extractors, message handler) · `README.md` · `icons/`
