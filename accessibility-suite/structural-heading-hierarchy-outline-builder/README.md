# Heading Outline — Page Structure Navigator

Extracts a page's heading hierarchy (h1–h6) into a clickable outline tree.

## What it does

- **Build outline** — reads all headings on the active tab in document order and renders them as an indented tree (h1 at root, deeper levels indented).
- **Click to navigate** — clicking any heading scrolls the page to it and flashes a highlight ring.
- **Skipped-level flags** — warns when heading levels jump (e.g. h1 → h3 skips h2), a common accessibility issue.
- **Summary stats** — total count plus per-level breakdown (h1×2 · h2×5 …).

## Honest scope

Local analysis only: it reads heading tags already in the page DOM. It does not evaluate visual hierarchy, ARIA headings, or content quality.

## Permissions

| Permission | Why |
|---|---|
| `activeTab` + `scripting` | Read headings / scroll only when you click |

No `storage`, no host permissions, no network. Nothing leaves your device.

## Install (developer mode)

1. Open `chrome://extensions`, enable **Developer mode**.
2. **Load unpacked** → select this folder.
3. Click the icon on any article or docs page.

## Files

- `manifest.json` — MV3 manifest
- `popup.html` / `popup.css` / `popup.js` — 380px glassmorphism popup
- `content.js` — heading extraction + scroll-to
- `icons/` — generated PNG icons (16/48/128)
