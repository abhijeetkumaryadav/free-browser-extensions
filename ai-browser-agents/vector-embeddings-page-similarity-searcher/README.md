# LexiMatch — Keyword Similarity Search (v1.0.0)

Save pages and notes, then find them again with **keyword-similarity ranking**.

## Honest scope

This extension is **not** vector embeddings and **not** AI. It ranks your saved
items by keyword overlap using a TF-IDF scoring algorithm that runs entirely
on your device:

- Terms rare across your saved collection score higher (that's the "IDF" part).
- Title matches count 3× because titles are dense with intent.
- Term frequency is log-scaled so one repeated word can't dominate.
- "Find similar" re-queries with the item's own top-weighted terms.

There is no embedding model, no machine learning, no network call — ever.

## Features

- **Save this page** — extracts the readable text (article/main heuristic) of the
  active tab into your local collection. Re-saving a URL replaces its snapshot.
- **Add note** — save your own titled text snippets.
- **Search** — ranked results with match-score bars, highlighted terms in
  context snippets, and matched-term chips.
- **Find similar** — per-item button that surfaces the most keyword-similar
  saved items.
- Delete items individually; everything persists in `chrome.storage.local`.

## Install

**Chrome / Edge:** unzip → `chrome://extensions` → enable *Developer mode* →
*Load unpacked* → select the folder.
**Firefox:** `about:debugging` → *This Firefox* → *Load Temporary Add-on* →
select `manifest.json`. (MV3 in Firefox: `activeTab`/`scripting` supported;
behavior identical for this extension.)
**Opera:** `opera://extensions` → *Developer mode* → *Load unpacked*.

## Permissions (minimal, justified)

| Permission | Why |
|---|---|
| `storage` | Persists your saved pages/notes on-device. |
| `activeTab` | Lets the popup act on the tab you're viewing when you click *Save this page*. |
| `scripting` | Injects the text extractor into the active tab **only** when you click save. |

No host permissions, no background page, no network access of any kind.

## Publishing notes

- MV3 only; no deprecated APIs; no remote code.
- Privacy: collects nothing, transmits nothing. Safe to declare
  "does not collect user data" in store listings.
- Screenshot tip: save 2–3 pages, search a keyword, show the score bars.

## Limitations

- Works on the text it extracted at save time; pages that change won't
  re-index until re-saved.
- Cannot save `chrome://` / Web Store pages (browser restriction).
- Keyword matching has no understanding of synonyms ("car" ≠ "automobile").
