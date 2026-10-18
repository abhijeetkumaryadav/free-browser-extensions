# Recall — Smart History Search (v1.0.0)

Search your browser history with **keyword ranking**, date filters and
day grouping.

## Honest scope

This extension is **not** semantic search and **not** AI. It calls
`chrome.history.search` and then re-ranks results with a transparent
keyword algorithm:

- Title matches weigh **3×** (intent lives in titles).
- Hostname matches weigh 1.5×, other URL matches 1×.
- A small log-scaled visit-count bonus surfaces pages you actually use.
- With no query, results are pure recency.

No embeddings, no machine learning, no network call — ever.

## Features

- **Keyword search** across titles and URLs with matched-term highlighting.
- **Date filters**: All time / Today / Last 7 days / Last 30 days (persisted).
- **Grouped by day**: Today, Yesterday, then calendar dates.
- Per-entry **visit time**, **visit count**, one-click **Open** and **Delete**.
- **Clear shown** — two-step confirm bulk-deletes exactly the entries
  currently displayed.

## Install

**Chrome / Edge:** unzip → `chrome://extensions` → enable *Developer mode* →
*Load unpacked* → select the folder.
**Firefox:** history search works the same; load via `about:debugging` →
*This Firefox* → *Load Temporary Add-on*.
**Opera:** `opera://extensions` → *Developer mode* → *Load unpacked*.

## Permissions (minimal, justified)

| Permission | Why |
|---|---|
| `history` | Required to query, open, and delete history entries — the entire point of the extension. |
| `storage` | Persists your chosen date-range filter on-device. |

No host permissions, no background page, no network access of any kind.
Favicons are not fetched (that would phone home); domain chips are
text-based.

## Publishing notes

- MV3 only; no deprecated APIs; no remote code.
- Privacy: reads history only to display it to you; collects nothing,
  transmits nothing. The store listing must still disclose the `history`
  permission honestly ("reads your browsing history to power search").
- Screenshot tip: search a keyword, show highlighted matches grouped by day.

## Limitations

- Keyword matching has no understanding of synonyms ("car" ≠ "automobile").
- `chrome://` pages are excluded from results (browser restriction).
- Search is capped at 1000 candidates per query for performance.
