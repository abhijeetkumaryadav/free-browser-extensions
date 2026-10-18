# Ask Toolbar — Multi-Engine Search Helper

A retro toolbar-style search helper. Type once, click an engine, and the query
opens in that engine's search page — or hit **All** to open it in every
enabled engine.

## Features

- Customizable engine list: add engines with a name + URL template (`%s` marks the query)
- Per-engine enable/disable (controls what "All" opens)
- Click any engine row to search with it; Enter searches with the first enabled engine
- Ships with classics preloaded: Google, DuckDuckGo, Bing, Brave Search, Mojeek
- "Restore classics" resets to the defaults
- Fully local — the only network traffic is the search page *you* asked to open

## Honest scope

This opens search pages — it is **not** an Ask.com revival and does no searching
itself.

## Permissions

- `storage` — save your custom engine list

## Build

- Manifest V3, popup-only. Validate with `node --check popup.js`.
- Icons: `icons/icon16.png`, `icons/icon48.png`, `icons/icon128.png` (generated with PIL).
