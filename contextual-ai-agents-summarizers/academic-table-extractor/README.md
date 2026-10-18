# Academic Table Extractor v1.0.0

On any page with HTML tables (research papers, reports, Wikipedia),
it detects every table, lists them with row × column counts and a
content preview, and lets you export the one you pick to CSV with a
single click. Best-effort: merged cells are flattened row by row.

## Try it
1. Unzip `academic-table-extractor.zip`.
2. `chrome://extensions` → Developer mode → **Load unpacked** → select folder.
3. Open a page with tables (e.g. a Wikipedia article) → click the icon → pick a table → **Export CSV**.

## Publishing notes
- Permissions: `activeTab` + `scripting` (read tables on the page you
  view), `storage` (reserved for future preferences). Nothing uploaded.
- Chrome Web Store: $5 one-time dev fee.
