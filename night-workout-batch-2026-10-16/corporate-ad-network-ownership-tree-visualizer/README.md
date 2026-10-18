# Ad Network Ownership Tree

Educational ownership visualizer (v1.0.0). Renders an interactive tree of
ad-tech company ownership relationships — which ad networks, DSPs, and SSPs
belong to which parent companies — with instant search and an editor to
add/update/remove entries. Edits persist on the device.

## Honest scope

The tree is **bundled static reference data** — an approximate educational
snapshot, not live corporate records. Acquisitions, rebrands, and shutdowns
happen constantly; verify anything important against official sources.

## Permissions

- `storage` — only to remember your edits to the tree.

## Files

- `manifest.json` — MV3 manifest
- `popup.html` / `popup.css` / `popup.js` — 380px glassmorphism popup UI
- `data.js` — the static reference tree (clearly labeled in a header comment)
- `icons/` — generated PNG icons (16/48/128)

## Development build

Not tested in a live browser. Validated: manifest parses, `node --check` on all
JS, icons generated, `manifest.json` at ZIP root.
