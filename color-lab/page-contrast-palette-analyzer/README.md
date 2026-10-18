# ContrastLens — Page Contrast Analyzer

Scans the current page's text/background color pairs, computes WCAG contrast
ratios, and flags pairs that fail AA (4.5:1) / AAA (7:1) with per-pair fix
suggestions. Sorted worst-first so the biggest offenders are on top.

## Install (development build)

**Chrome / Edge / Opera**
1. Unzip `page-contrast-palette-analyzer.zip` anywhere.
2. Open `chrome://extensions`, enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

**Firefox**
1. Unzip the package.
2. Open `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on**.
3. Select `manifest.json`. (Temporary: reload after each browser restart.)

## Usage

1. Open any web page.
2. Click the ContrastLens toolbar icon → **Scan this page**.
3. Review unique color pairs, ratios, AA/AAA badges, and suggestions.

## Permissions

- `activeTab` — run the one-shot contrast scan in the tab you clicked on.
- `scripting` — inject the self-contained scanner function (user gesture only).

No network requests. No data leaves your device. Read-only: the page is never
modified.

## Honest limits

- Heuristic scan of **computed** `color` / `background-color` only.
- Background images, gradients, and semi-transparent layering are ignored.
- If no opaque ancestor background is found, white is assumed.
- Not a substitute for a full accessibility audit.

## Publishing notes

- Manifest V3, no remote code, no analytics.
- Screenshots should show the popup over a sample page with failing pairs.
