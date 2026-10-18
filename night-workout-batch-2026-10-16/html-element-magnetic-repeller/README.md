# HTML Element Magnetic Repeller

A playful visual toy: page elements are pushed away from your cursor like a magnet in reverse.

## What it does

- Click **Start repelling** — visible page elements are visually pushed away from your cursor within the repel radius.
- Adjustable **repel strength** (10–120) and **repel radius** (80–400px), live-updated while running.
- Smooth physics: clones glide away and settle back as the cursor moves.

## Honest scope

- **Visual toy only.** The elements you see moving are lightweight **clones on a single fixed overlay container** — each tinted with its tag name.
- The real page DOM is **never modified** — nothing is moved, edited, or restyled on the actual page.
- Click **Restore page** or press **Esc** to remove the overlay and return the page exactly as it was. Nothing persists on the page.
- 100% local. No network requests, no analytics, no data leaves your browser.

## Permissions

- `activeTab` + `scripting` — inject the overlay content script on the tab you click Start on, only when you click it.
- `storage` — remember your strength/radius preferences.

## Files

- `manifest.json` — Manifest V3
- `popup.html` / `popup.css` / `popup.js` — settings UI
- `content.js` — clone-overlay repel engine
- `icons/` — generated PNG icons (16/48/128)

## Install

1. Open `chrome://extensions` (or `edge://extensions`), enable Developer mode.
2. Click **Load unpacked** and select this folder.
3. Pin the extension and click its icon to open the repeller controls.
