# VaultLink — Markdown Notes Vault

An Obsidian-style notes vault that lives entirely in your browser popup. Create markdown notes, link them with `[[wiki-links]]`, browse backlinks, explore a lite link graph, search, and export to Markdown.

## Install

**Chrome / Edge**
1. Download and unzip `markdown-obsidian-vault-linker.zip`.
2. Open `chrome://extensions`, enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

**Firefox** — load via `about:debugging` → This Firefox → Load Temporary Add-on (MV3 support is maturing; `storage.local` works).

## Use

- **New** — create a note. Title + Markdown body, autosaves as you type.
- **Edit / Preview** — toggle the rendered view. Preview supports headings, bold/italic, lists, code blocks, quotes, external links, and `[[wiki-links]]`.
- **Wiki-links** — type `[[Other note]]` or `[[Other note|alias]]`. In Preview, click a link to jump to that note; clicking a *missing* (dashed) link creates it.
- **Backlinks** — every note shows which other notes link to it.
- **Search** — filters titles and bodies live.
- **Graph** — stats (notes, wiki-links, orphans) plus a list view of each note's outgoing links and backlink counts, sorted by most-linked.
- **Export** — downloads each note as a separate `.md` file (staggered so the browser accepts them).

## Permissions

| Permission | Why |
|---|---|
| `storage` | Persist your vault on this device. That's the only permission — no tabs, no network. |

## Notes & limits

- Markdown is a built-in lightweight renderer (headings, lists, code, quotes, bold/italic, links); tables and footnotes are not supported.
- Wiki-link matching is by exact title (case-insensitive). Renaming a note does not rewrite links that point to the old title — a known limitation shared with plain-text vaults.
- 100% local: no accounts, no sync, no network calls.

## Publishing notes

- Store-safe: single `storage` permission, no remote code, no data collection. The export uses blob downloads (no `downloads` permission needed).
