# PaletteGrab — Site Color Palette Extractor

Extracts the dominant colors used on the current page from computed styles,
shows them as a clickable palette with usage breakdowns (text / background /
border), and exports as CSS variables or JSON.

## Install (development build)

**Chrome / Edge / Opera**
1. Unzip `site-color-palette-css-extractor.zip` anywhere.
2. Open `chrome://extensions`, enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

**Firefox**
1. Unzip the package.
2. Open `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on**.
3. Select `manifest.json`. (Temporary: reload after each browser restart.)

## Usage

1. Open any web page.
2. Click the PaletteGrab toolbar icon → **Extract page palette**.
3. Click any swatch to copy its hex.
4. **Copy CSS vars** copies a `:root { --palette-01: …; }` block.
5. **.css** / **.json** download the palette (blob download, no extra permission).

## Permissions

- `activeTab` — run the one-shot extraction in the tab you clicked on.
- `scripting` — inject the self-contained extractor function (user gesture only).

No network requests. No data leaves your device. Read-only: the page is never
modified.

## Honest limits

- Heuristic extraction from **computed** `color`, `background-color`, and border
  colors only; images, gradients, and shadows are ignored.
- Transparent colors are skipped; near-duplicate shades are not merged.
- Up to 12 most frequent colors are shown.

## Publishing notes

- Manifest V3, no remote code, no analytics.
- Screenshots should show the popup over a colorful site with the palette grid.
