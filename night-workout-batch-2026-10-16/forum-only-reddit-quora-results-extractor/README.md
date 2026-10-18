# Forum-Only Filter — Reddit & Quora Results

A one-click filter for search-result pages: **keeps only results that point at
forum/discussion sites** and dims (or hides) everything else. Built-in forum
signals: `reddit.com`, `quora.com`, the Stack Exchange network, plus any URL
whose host or path mentions `forum`, `community`, or `discuss`. You can add
your own domains too.

## Honest scope

- **Heuristic URL matching only.** It judges the link target's domain — it does
  not read the destination page, and it can miss unusual result layouts.
- **Your choice, fully reversible.** Nothing runs automatically; one click on
  “Restore page” puts everything back exactly.
- **100% local.** No network calls, no analytics, no data leaves your browser.

## How to use

1. Open any search-results page (Google, Bing, DuckDuckGo, …).
2. Click the extension icon → **Filter to forums**.
3. Non-forum results are dimmed (or hidden, per your setting); the status line
   shows how many were kept.
4. Click **Restore page** to undo.

## Permissions

- `storage` — remembers your mode and extra domains.
- `activeTab` + `scripting` — injects the scanner only when you click the
  button. No host permissions, no always-on content script.

## Files

- `manifest.json` — MV3 manifest
- `popup.html` / `popup.css` / `popup.js` — the popup UI
- `content.js` — page-side scan/dim/restore engine (boot-once, message-driven)
- `icons/` — generated PNG icons (16/48/128)
