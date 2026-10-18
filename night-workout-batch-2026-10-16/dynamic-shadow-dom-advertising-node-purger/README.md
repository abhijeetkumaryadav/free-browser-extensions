# Ad-Node Purger — Shadow-DOM Ad Hider

User-triggered, heuristic ad-container hider for the active tab.

## Honest scope

- **Heuristic only.** It matches common ad-container selector patterns (bundled list + your own custom selectors). It can hide non-ad elements that happen to match. Everything is reversible with one click.
- **Click-only.** Nothing runs until you press "Purge ad nodes". No background scanning, no network, no data leaves the browser.
- **Visibility-only.** Hidden elements are set to `display:none` with their previous value remembered; the page DOM is never modified and restore removes every trace.

## Features

- Scans the document, **open shadow roots** (recursive, depth-capped), and same-origin iframes
- Bundled heuristic selector list + your own custom selectors (one per line, saved locally)
- Live count of hidden nodes, including how many came from shadow DOM
- One-click **Restore** returns the page to its original state
- Options: shadow-root scan on/off, iframe scan on/off

## Permissions

- `storage` — your custom selectors and options
- `activeTab` + `scripting` — inject the scanner into the current tab only when you click

## Files

`manifest.json` · `popup.html` · `popup.css` · `popup.js` · `content.js` (scanner engine) · `background.js` · `README.md` · `icons/`

## Build

```bash
cd dynamic-shadow-dom-advertising-node-purger
zip -r dynamic-shadow-dom-advertising-node-purger.zip manifest.json popup.html popup.css popup.js content.js background.js README.md icons/
```
