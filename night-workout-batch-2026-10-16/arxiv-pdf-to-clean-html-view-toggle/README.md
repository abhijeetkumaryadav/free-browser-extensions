# Clean Read Toggle — Reading Overlay

User-triggered clean reading view. Click the button in the popup and the
extension extracts the current tab's main text into a distraction-free
overlay. Click again (or ✕ Close) and the overlay is removed — **the page
is left completely untouched**.

## Features

- Heuristic article extraction: `<article>` first, then `<main>`, then the
  longest text block; nav/header/footer/aside/scripts skipped
- Distraction-free serif layout, max 680px column
- Fully reversible toggle — no page state is modified

## Files

- `manifest.json` — Manifest V3, `activeTab` + `scripting` (injects only into
  the tab you clicked from)
- `popup.html` / `popup.css` / `popup.js` — UI, extraction helpers, overlay
- `icons/` — generated PNG icons (16/48/128)

## Permissions

- `activeTab` — lets the extension act on the tab you click from
- `scripting` — injects the overlay into that tab

No network access. Everything runs locally.

## Honest limits

- **Heuristic extraction — best effort.** The "article" is a guess based on
  markup; on odd page layouts it may pick the wrong block or show little
  text. Images, tables, and formatting are not carried over.
