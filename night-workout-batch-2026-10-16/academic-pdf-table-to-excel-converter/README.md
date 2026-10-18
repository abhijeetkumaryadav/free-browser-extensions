# Table Grabber: Web Table → Excel (CSV)

## Honest scope
Finds **HTML `<table>` elements on the current web page**, previews them, lets you
pick columns, and exports **CSV** (opens in Excel / Google Sheets). It does **not**
read, parse, or extract tables from **PDF files** — PDF parsing is not possible
inside a browser extension. The banner in the popup states this plainly.

## Use
1. Open any page with a table (e.g. a Wikipedia data table).
2. Click the extension icon → **Scan page for tables**.
3. Pick a table → tick the columns you want.
4. **Export CSV** (UTF-8 with BOM so Excel shows characters correctly) or **Copy CSV**.

## Privacy
- Runs only when you click Scan, only on the active tab.
- No network calls, no analytics, no data leaves your browser.
- Permissions: `storage` (settings), `activeTab` + `scripting` (click-only scan).

## Files
`manifest.json`, `popup.html`, `popup.css`, `popup.js`, `icons/`, `README.md`
