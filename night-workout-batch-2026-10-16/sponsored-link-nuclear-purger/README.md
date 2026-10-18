# Sponsored Link Nuclear Purger

A user-triggered cleaner that dims or collapses sponsored / ad-labeled cards on the
current page — search-result ads, "Sponsored" feed units, promoted listings.

## Honest scope

- **Heuristic detection only.** It looks for short labels or attributes containing
  words like "sponsored", "advertisement", or "promoted", then hides the enclosing
  card. It can miss units or misfire on innocent content — the popup says so and
  shows what was matched.
- **Your choice, always.** Nothing runs until you click **Purge this page**.
- **Fully reversible.** One click on **Restore** puts every card back exactly as it
  was (original inline styles are saved before hiding).
- **100% local.** No network calls, no telemetry, nothing leaves the tab.

## How it works

1. Click **Purge this page**. The page engine (`content.js`) is injected into the
   active tab on demand — never before, and never on browser-internal pages
   (`chrome://`, `about:`, etc.).
2. It scans for sponsored-label candidates, finds each label's enclosing card
   (walked up to a list level), and either dims it (22% opacity + red dashed
   outline) or collapses it (`display: none`), per your mode preference.
3. The popup reports how many cards were hidden and shows the matched labels.
4. **Restore** undoes everything.

## Permissions

- `storage` — remembers your dim/collapse preference.
- `activeTab` + `scripting` — inject the engine into the current tab only when you
  click, and only on pages you can see.

## Files

| File | Purpose |
|---|---|
| `manifest.json` | MV3 manifest |
| `popup.html` / `popup.css` / `popup.js` | Popup UI + orchestration |
| `content.js` | Page-side scan/hide/restore engine |
| `icons/` | Generated PNG icons (16/48/128) |

Not tested in a live browser yet — validation covered manifest parsing, JS syntax,
icon generation, and ZIP structure.
