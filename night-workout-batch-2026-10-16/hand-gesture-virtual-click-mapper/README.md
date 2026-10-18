# Click Keys — Keyboard Click Mapper

## What it does
Map single keyboard shortcuts to page elements (CSS selectors). Press the key and the matching element gets clicked.

**Honest scope (labeled in popup):** keyboard-triggered clicks — not hand gestures. No camera, no pose tracking, no ML.

## How to use
1. Add a mapping: a single key (e.g. `g`) + a CSS selector (e.g. `#load-more`).
2. Click **Enable on this tab** once per tab (explicit opt-in; nothing runs otherwise).
3. Press your key on the page — the first matching element is focused and clicked.

## Safety rules (built in)
- Never clicks password, file, or hidden inputs
- Keys are ignored while typing in text fields or when Ctrl/Cmd/Alt are held
- Mappings are per your own entry; edit or remove anytime

## Permissions (minimal)
- `storage` — save mappings locally
- `activeTab` + `scripting` — inject the click engine into the tab only after you click Enable

## Limitations
- One element per key (first `querySelector` match)
- Must re-enable per tab / after navigation
- Cannot run on `chrome://`, extension, or web-store pages
