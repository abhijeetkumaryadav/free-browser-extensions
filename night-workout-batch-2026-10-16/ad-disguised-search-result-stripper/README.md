# Ad-Stripper — Disguised Search Ad Collapser

**Heuristic, your choice, reversible.**

On your explicit click only, this extension scans the active search-results page for
results that carry ad signals — things like `"Ad"` / `"Sponsored"` / `"Promoted"`
labels, ad-click/tracking URLs (e.g. `aclk`, `doubleclick`, `gclid=`), and
advertising language. Matching results are **collapsed (hidden)**, never deleted,
with a per-item reason list shown in the popup.

**Important limits (read me):**
- Detection is a set of best-effort **heuristics** — false positives and misses are possible.
- **Nothing runs automatically.** The scan happens only when you press the button.
- One click on **Restore all** un-collapses every item on the tab.
- No network calls, no analytics, nothing leaves your browser. `storage` keeps your
  settings and lifetime collapse count locally.

## Permissions

- `activeTab` + `scripting` — inject the scan/collapse functions into the tab you
  explicitly click on. That's the only page access.
- `storage` — remember the aggressive-mode setting and collapse counts.

## Files

`manifest.json` · `popup.html` · `popup.css` · `popup.js` · `content.js` (scan/restore functions) · `README.md` · icons

## Install (developer mode)

1. `chrome://extensions` → enable Developer mode → Load unpacked → this folder.
2. Open a search engine results page, click the extension, then **Scan & collapse ads**.
