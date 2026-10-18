# DOM Depth Analyzer

**Honest scope:** Depth analysis only — **not** 3D extrusion. This extension
performs a read-only scan of the active tab's DOM tree. It never modifies
the page and makes no network calls.

## What it does

Click **Scan this tab's DOM** (the content script is injected on click only):

- **Max depth** of the DOM tree, total element count, and count of elements
  at depth ≥ 15 (a common "too deep" threshold)
- **Nodes-per-depth bar chart** — levels at depth ≥ 15 highlighted
- **Deepest elements** — tag, classes, and a short ancestor path for the
  12 deepest nodes

## Files

- `manifest.json` — Manifest V3; `storage`, `activeTab`, `scripting`
- `popup.html` / `popup.css` / `popup.js` — analyzer UI
- `content.js` — read-only DOM walker (iterative DFS, message API
  `{type:'ANALYZE_DEPTH'}`)
- `icons/` — generated 16/48/128 PNG icons
- `README.md` — this file

## Permissions

- `activeTab` + `scripting` — inject the analyzer into the clicked tab only
- `storage` — reserved for future settings; nothing is transmitted
- Internal browser pages (`chrome://`, etc.) show a friendly off-limits note
