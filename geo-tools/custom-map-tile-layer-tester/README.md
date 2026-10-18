# TileTest — Custom Map Tile Previewer v1.0.0

Preview a single map tile from any URL template you provide. Enter z/x/y directly
or a lat/lng + zoom (converted locally to slippy-map tiles).

## Install
1. Unzip the release.
2. Open `chrome://extensions` (Edge: `edge://extensions`), enable **Developer mode**.
3. **Load unpacked** → select this folder.
4. Firefox: `about:debugging#/runtime/this-firefox` → Load Temporary Add-on.

## Permissions
- `storage` — remembers your last URL template and coordinates.

## Scope notes
- Renders exactly ONE tile at a time — this is a tile tester, not a full map viewer.
- The tile is loaded from a URL *you* type; no network happens otherwise.
- Respect tile-server usage policies (e.g. OSM's tile usage policy).

## Publishing notes
- Manifest V3, no deprecated APIs, no remote code.
- `{s}` subdomains are pinned to `a` to keep requests predictable.
