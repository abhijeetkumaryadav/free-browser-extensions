# Universal Markdown Clipper for Obsidian

Clip any web page to clean Markdown with an Obsidian-friendly template: YAML frontmatter (title, source URL, date), H1 title, source link, and converted body text (headings, links, lists, quotes, code blocks, optional images).

## Features

- **Clip selection or page** — toggle to clip only highlighted text; otherwise the main article content is detected (`<article>` / `<main>` first, cleaned body as fallback)
- **YAML frontmatter** — optional `title` / `source` / `clipped` date block
- **Copy or download** — copy Markdown to the clipboard or download a `.md` file
- **Preferences persist** — your checkbox choices are remembered
- **Obsidian-style template** — ready to paste straight into a note

## Honest scope

- This copies Markdown to your clipboard or downloads a `.md` file. It does **not** write into your Obsidian vault — paste or drop the file in yourself.
- Works on regular `http(s)` pages only, not `chrome://` internal pages.
- The HTML→Markdown conversion is best-effort; complex layouts may lose some formatting.
- 100% local. No network calls, no analytics.

## Permissions

- `storage` — saves your clip preferences
- `activeTab` + `scripting` — reads the current page only when you click "Clip"

## Files

- `manifest.json` — MV3 manifest
- `popup.html` / `popup.css` / `popup.js` — clip controls + preview UI
- `content.js` — page extraction + HTML→Markdown converter (injected on click)
- `icons/` — generated PNG icons
