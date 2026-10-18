# Layout to Tailwind Wireframe Converter

Converts the **visible layout** of the current page into a standalone **Tailwind-style wireframe HTML file** — real content is replaced by labelled placeholder boxes (blue = media, amber = buttons/links, grey = text, green = logo).

## Honest scope

- ✅ **Heuristic DOM → utility mapping**: tag, size, and position decide the placeholders (headers → nav bar sketch, images → aspect-ratio boxes, paragraphs → text bars, forms → dashed inputs).
- ✅ Utility classes are **defined inline** in the exported HTML (hand-written subset) — **no Tailwind CDN, no remote code**, the file works fully offline.
- ❌ **Not a pixel-perfect replica.** It is a structural sketch: colours, fonts, spacing rhythms and absolute positioning are approximated or ignored.
- ❌ No real page content is copied into the wireframe — everything becomes placeholder boxes.

## Features

- One-click generation from the active tab (injected on demand, click-only)
- Placeholder-block and file-size stats before download
- One-click download of the standalone `wireframe.html`
- 100% local — no network, no accounts

## Permissions

- `activeTab` — read the layout of the tab you clicked on
- `scripting` — inject the analyzer on demand only
- `storage` — reserved for future settings (minimal use)

## Files

- `manifest.json` — MV3 manifest
- `popup.html` / `popup.css` / `popup.js` — popup UI and download logic
- `content.js` — DOM walker, heuristic mapper, HTML generator
- `icons/` — generated PNG icons (16/48/128)

## Install (developer mode)

1. Open `chrome://extensions`, enable **Developer mode**
2. **Load unpacked** → select this folder
3. Open any page, click the extension, click **Generate wireframe**
