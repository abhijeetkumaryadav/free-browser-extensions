# Matrix Node Network — Cyberspace Bookmark Visualizer

## What it is (honest scope)
A **cosmetic visualizer**: your browser bookmarks rendered as glowing nodes over an
animated matrix-rain canvas. You create **groups** (e.g. "Work", "Fun") and assign
bookmarks to them — nodes sharing a group get linked with glowing edges. Clicking a
node opens that bookmark in a new tab.

**Cosmetic — your bookmarks only.** Nothing is downloaded, uploaded, or measured.
Bookmarks never leave your browser; group assignments stay in `chrome.storage.local`.

## Features
- Animated matrix-rain background (canvas, seeded for a stable look)
- Deterministic node layout — nodes stay inside the canvas
- Manual groups with per-group colors; edges link grouped nodes
- Click a node to open its bookmark
- Group assignments persist locally

## Permissions
- `bookmarks` — read your bookmark list to draw nodes (local only)
- `storage` — save groups and assignments locally

## Privacy
Zero network. Fully local.
