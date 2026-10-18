# Offline Page Indexer — Local Keyword Search

An **offline library of pages you save**, with instant **keyword full-text search**.

## Honest scope (read first)

- **Keyword search only.** Matching is literal token matching with title weighting —
  no embeddings, no synonyms, no semantic understanding.
- **Not AI, not RAG, not a language model.** The original "local LLM RAG" concept
  cannot run inside a browser extension, so this is the honest version: a local
  full-text index of pages *you choose to save*.
- **100% offline.** Extraction happens in the page, storage is
  `chrome.storage.local`, there are zero network calls.
- Pages are saved only when **you click "Save this page"** — nothing is indexed
  automatically in the background.
- Snippets shown in results are literal text from the saved page.

## Features

- **Save this page** — extracts readable text (main/article preferred) and stores
  it locally (capped at 500 pages, ~120k chars each).
- **Instant search** — as-you-type keyword scoring: title hits ×10, capped body
  frequency, all-terms bonus. Click a result to open the original page.
- **Highlight snippets** — matched term highlighted in context.
- **Export JSON** — take your library with you. **Clear library** — wipe it.

## Files

- `manifest.json` — MV3, permissions: `storage`, `activeTab`, `scripting`
- `popup.html` / `popup.css` / `popup.js` — 380px deep-dark glassmorphism UI;
  the extractor is a `func` passed to `chrome.scripting.executeScript`

## Install

1. `chrome://extensions` → enable Developer mode → Load unpacked → select this folder.
2. Open an article, click the extension, **Save this page**, then search.

## Limitations

- Keyword matching is literal — "car" won't match "automobile".
- Dynamic pages: whatever text is in the DOM at save time is what gets indexed.
