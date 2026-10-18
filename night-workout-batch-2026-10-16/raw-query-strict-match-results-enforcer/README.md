# Strict Match Filter — Query Term Enforcer

**Honest scope:** this extension dims (or collapses) search-result cards whose text does not contain **all** of your query terms. It is **text matching only** — it cannot understand meaning, synonyms, or intent. Nothing runs until you click **Filter this page**, and **Restore** returns the page exactly.

## How it works

1. Type your query terms in the popup (space-separated).
2. Choose **Dim** (non-matches fade to 22% with an amber outline) or **Collapse** (non-matches hidden).
3. Click **Filter this page** — a click-only content script scans likely result cards
   (Google/Bing/DuckDuckGo layouts plus a generic fallback) and checks each card's
   visible text for every term.
4. The popup shows cards checked / matched / dimmed-or-collapsed.
5. Click **Restore** at any time to put the page back exactly (original inline
   styles are stashed before any change).

Terms and mode are remembered between popup opens. Matching is case-insensitive
substring matching — no stemming, no AI.

## Permissions

- `storage` — remember your terms, mode, nothing else.
- `activeTab` + `scripting` — inject the page engine **only on your explicit click**,
  only on the active tab. No background running, no network calls.

## Files

`manifest.json`, `popup.html`, `popup.css`, `popup.js`, `content.js`, `README.md`, `icons/`.

Built for the extension marathon. Manifest V3. Not tested in a live browser —
validation covered manifest parsing, JS syntax, icon sizes, and ZIP structure.
