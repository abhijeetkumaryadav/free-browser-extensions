# Citation Notes Graph — My Paper Network

A personal citation-network notebook. Save papers, mark which ones cite which, and sketch your network on a draggable canvas. Each paper gets a one-click Semantic Scholar search link.

## Honest scope

**Your notes — not a live graph.** There is no live citation data here:

- You add every paper yourself.
- You mark every "cites" link yourself.
- The graph canvas is an auto-arranged sketch of your own entries — you can drag nodes around.
- "Search S2" buttons just open a Semantic Scholar search for the title in a new tab. The extension itself makes **zero network calls**.

## Features

- Add papers: title, authors, year, DOI, your note, and manual cite-links to other saved papers.
- Draggable network sketch with arrowed cite-links.
- Per-paper Semantic Scholar search link and DOI link.
- Search across title/authors/notes; per-paper delete; clear-all with confirm.
- Export / import JSON backup.
- Everything stored in `chrome.storage.local`.

## Files

- `manifest.json` — MV3, `storage` permission only
- `popup.html` / `popup.css` / `popup.js`
- `icons/` — generated PNG icons (16/48/128)
- `README.md`

## Test

Headless engine tests cover paper creation, year clamping, search-URL encoding,
circle layout, link counting, filtering, and import validation. Run with node
by extracting the code between `// ENGINE-START` and `// ENGINE-END` in `popup.js`.
