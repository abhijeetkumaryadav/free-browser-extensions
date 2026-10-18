# Local Document Index

Import text/markdown documents and search them with a local full-text keyword
index using term-frequency (TF) ranking, with contextual snippet results.

## Honest scope

**Keyword index — NOT RAG.** The original idea promised retrieval-augmented
generation, which needs embedding models and an LLM. This build implements only
what runs locally and deterministically: a classic inverted term-frequency
index over documents you import. No AI models, no semantic similarity, no
network requests. All documents stay in `chrome.storage.local` on this device.

## Features

- **Import** `.txt` / `.md` files (5 MB per file, 200k chars per document cap).
- **Search** ranks documents by term frequency; results show a contextual snippet
  with matched terms highlighted.
- **Manage** the index: per-document remove, clear-all with confirmation.

## Permissions

- `storage` — store the imported documents and their index locally.

## Files

`manifest.json`, `popup.html`, `popup.css`, `popup.js`, `icons/`, `README.md`.

Development build — not yet tested in a live browser beyond static validation.
