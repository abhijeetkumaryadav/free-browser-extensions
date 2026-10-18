# Local History Search

Fast, typo-tolerant **fuzzy full-text search** over your own Chrome browsing history — no servers, no AI.

## How it works

- On open, the popup indexes up to 5,000 history entries locally (in memory only).
- Type to search titles and URLs. Scoring combines:
  - **trigram overlap** (tolerates typos like `spreadseet`),
  - exact-phrase bonus,
  - title-start bonus,
  - word-coverage bonus.
- Filters: **when** (24h / 7d / 30d / any), **domain**, and **sort** (relevance / most recent / most visited).
- Click a result to open it; **remove** deletes it from history.

## Honest scope (read this first)

- This is **keyword + fuzzy text matching only**. It is NOT semantic or vector search — there are no embeddings, no neural network, and it cannot understand meaning or intent. The extension name's "vector-database" phrasing refers to the old idea; the implementation is honest about what it is.
- Search matches are lexical: misspellings and word order variations are tolerated, synonyms are not.
- The index lives in the popup's memory and is rebuilt every open; nothing is stored on disk and nothing is transmitted.

## Permissions (justified)

- `history` — read your browsing history to search it. Required for the core feature.
- `storage` — future UI preferences (currently unused beyond convention).

## Privacy

Your history never leaves your machine. No network requests, no accounts, no telemetry.
