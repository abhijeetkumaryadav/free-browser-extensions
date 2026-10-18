# PaletteSwap — Website Color Palette Swapper

**What it does:** Recolors any web page on demand with a curated palette or your own colors.

- **4 presets** — Sunset, Ocean, Forest, Mono — one click to apply
- **Custom colors** — pick background, text and link colors
- **Remember for this site** — auto-restores your palette when you reopen the popup on that domain
- **Reset page** — removes the stylesheet and restores the page exactly; also clears the saved palette

**How it works:** pure CSS injection via a content script that runs only when you trigger it from the
popup (`activeTab` + programmatic injection). A single `<style>` node overrides background/text/link
colors; removing it restores the original page. Nothing is read from the page and nothing is transmitted.

**Permissions (minimal, justified):**
- `activeTab` — recolor the tab you are looking at, only when you click
- `scripting` — inject the recolor stylesheet on demand
- `storage` — remember per-site palettes locally

100% local. No network calls.

## Install (developer mode)
1. Open `chrome://extensions`, enable **Developer mode**
2. **Load unpacked** → select this folder
3. Click the PaletteSwap icon on any page

## Files
- `manifest.json` — MV3 manifest
- `popup.html/css/js` — palette picker UI
- `content.js` — applies/removes the recolor stylesheet
- `icons/` — generated 16/48/128 PNG icons

## Notes
- Tested: manifest parses, JS passes `node --check`, icons verified.
- Not tested in a live browser; development build.
