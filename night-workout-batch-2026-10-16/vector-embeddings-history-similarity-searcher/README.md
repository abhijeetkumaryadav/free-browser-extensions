# History Similarity Search — Fuzzy Trigram Finder

Find similar pages in your browsing history with **typo-tolerant fuzzy trigram matching**.

## Honest scope (please read)

- This is **keyword / fuzzy text similarity only**. It is **not** vector embeddings, **not** semantic AI, and has **no** embedding model.
- It cannot understand synonyms or meaning. "car" will not match "automobile" unless the characters overlap.
- All history data stays on this device. Nothing is transmitted anywhere.

## How it works

1. Open the popup — it indexes up to 5,000 local history entries in memory.
2. Type a query. Each entry is scored 0–100:
   - **50%** character-trigram overlap (typo-tolerant),
   - **20%** exact-phrase bonus,
   - **15%** title-start bonus,
   - **15%** word-coverage bonus.
3. Scores below 12% are filtered out as not similar enough.

## Features

- Live results with similarity % and relevance bar
- Filters: date range (24h / 7d / 30d / all), sort by relevance / recency / visits
- Click a card to open the page; **Remove** deletes the URL from history
- Empty query shows your most recent entries

## Permissions

- `history` — read browsing history for searching (required)
- `storage` — remember your filter preferences

## Build

Manifest V3. Zip with `manifest.json` at the archive root.
