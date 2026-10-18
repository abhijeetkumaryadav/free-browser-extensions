# True Free Software Open Source Only Filter

A user-triggered keyword filter that dims or hides result cards on the current page
whose text contains **your** keywords — for example, hiding results that say
"freemium", "trial", or "paid" while you hunt for free tools.

## Honest scope — read this first

- **It cannot know software licenses.** There is no API or signal that tells an
  extension whether a product is free software, open source, or proprietary. This
  tool matches plain keyword substrings you typed yourself. If a proprietary tool
  doesn't use your keywords, it stays visible; if an open-source tool mentions one
  of them, it gets hidden. **Review every hidden card.**
- **Your choice, always.** Nothing runs until you click **Filter this page**.
- **Fully reversible.** One click on **Restore** puts every card back exactly as it
  was (original inline styles are saved before hiding).
- **100% local.** Your keyword list lives in `chrome.storage.local` and never
  leaves your browser. No network calls, no telemetry.

## How it works

1. Add keywords in the popup (e.g. `freemium`, `trial`, `paid`, `enterprise`).
2. Click **Filter this page**. The page engine (`content.js`) is injected into the
   active tab on demand — never before, and never on browser-internal pages.
3. It scans result-like cards (links, list items, articles) for your keywords
   (case-insensitive substring), finds each match's enclosing card, and dims it
   (22% opacity + violet dashed outline) or collapses it (`display: none`), per
   your mode preference.
4. The popup reports how many cards were hidden and shows which keyword matched
   where. **Restore** undoes everything.

## Permissions

- `storage` — remembers your keyword list and dim/collapse preference.
- `activeTab` + `scripting` — inject the engine into the current tab only when you
  click, and only on pages you can see.

## Files

| File | Purpose |
|---|---|
| `manifest.json` | MV3 manifest |
| `popup.html` / `popup.css` / `popup.js` | Popup UI + keyword manager |
| `content.js` | Page-side scan/hide/restore engine |
| `icons/` | Generated PNG icons (16/48/128) |

Not tested in a live browser yet — validation covered manifest parsing, JS syntax,
icon generation, and ZIP structure.
