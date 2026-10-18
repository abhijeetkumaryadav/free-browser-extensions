# Page Context Packager

Turns the current web page into clean, structured markdown — chunked and ready to
paste into any LLM chat as context.

## Honest scope

> **This extension is NOT AI and NOT RAG.** It does no retrieval, no embeddings,
> and no language modeling. It extracts the page's readable text, formats it as
> markdown, splits it into overlapping chunks, and you paste those chunks into
> your own LLM chat yourself. That is the entire feature.

## Features

- **One-click extraction** of the active tab into structured markdown
  (headings, paragraphs, links, lists, blockquotes, tables)
- **Junk removal** — nav bars, headers, footers, ads, cookie banners, and
  newsletter popups are stripped from the output
- **Chunking controls** — set max chunk size (1,000–20,000 chars) and overlap;
  chunks split on paragraph boundaries
- **Chunk navigator** — preview, page through, and copy individual chunks
- **Copy all / Download .md** for the full extraction
- Settings (chunk size, overlap) persist locally

## How to use

1. Open any article or documentation page.
2. Click the extension icon, then **Extract this page**.
3. Page through the chunks in the preview.
4. **Copy this chunk** (or Copy all) and paste it into your LLM chat.

## Privacy

- 100% local. Nothing is sent anywhere — no network requests at all.
- The extension only runs when you click **Extract this page** (the content
  script is injected on demand via `chrome.scripting`).
- Page text is held in memory in the popup only; nothing is uploaded.

## Files

- `manifest.json` — Manifest V3 declaration
- `popup.html` / `popup.css` / `popup.js` — the 380px glassmorphism UI
- `content.js` — the DOM → markdown extractor (injected on demand)
- `icons/` — generated PNG icons (16/48/128)
