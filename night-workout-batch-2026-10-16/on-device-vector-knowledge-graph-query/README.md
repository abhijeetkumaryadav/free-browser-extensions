# Keyword Knowledge Graph

A local knowledge graph: create notes, link them together manually, visualize the
graph on a canvas, and search notes with relevance-ranked keyword matching.

## Honest scope

**Keyword graph — NOT vector search.** This extension uses plain term-frequency
keyword matching. There are no embeddings, no semantic similarity, no AI models,
and no network requests. The name of the original idea overpromised; this build
implements only what runs locally and deterministically.

## Features

- **Notes tab** — create notes with a title and body, link each note to others
  (multi-select). Edit-safe storage in `chrome.storage.local`.
- **Graph tab** — canvas visualization: nodes with links drawn as edges, shuffle
  layout, clear-all.
- **Search tab** — keyword search ranked by term frequency (title matches weigh
  3×), with matched terms highlighted.

## Permissions

- `storage` — persist your notes locally.

## Files

`manifest.json`, `popup.html`, `popup.css`, `popup.js`, `icons/`, `README.md`.

Development build — not yet tested in a live browser beyond static validation.
