# ChartForge — CSV Chart Builder

Build clean bar, line, and pie charts from pasted CSV data with a hand-written canvas renderer — no chart libraries, no network, no servers. Everything runs locally in the popup.

## Features

- **Paste CSV data** — auto-detects comma, tab, semicolon, or pipe delimiters; honors quoted fields
- **Column mapping** — pick any column for X-axis labels; numeric columns are auto-detected for Y series
- **Three chart types** — grouped bar, multi-line with points, and pie (first Y series) with % labels
- **Hand-written renderer** — crisp HiDPI canvas output with gridlines, nice-number axes, and a legend
- **Custom title + 4 palettes** — Emerald, Sunset, Ocean, Mono
- **PNG export** — one-click download at 640×400 (HiDPI-scaled), filename from your title
- **Settings memory** — title, palette, and chart type restored on reopen
- **Live stats** — category and series counts under the preview

## Install

**Chrome / Edge**
1. Download and unzip `grid-financial-model-chart-builder.zip`
2. Open `chrome://extensions` (or `edge://extensions`)
3. Enable **Developer mode**
4. Click **Load unpacked** and select the unzipped folder

**Firefox**
1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on** and select `manifest.json`

Works identically in any Chromium or Firefox browser.

## Permissions

| Permission | Why |
|---|---|
| `storage` | Remembers your title, palette, chart type, and column choices |

No host permissions, no content scripts, no network access. Your data never leaves the browser.

## Publishing notes

- Manifest V3, zero dependencies, no remote code
- Clearly labeled as simple charts — not a BI tool: no aggregations, pivots, or formulas
- Screenshots: load the sample data, switch between Bar/Line/Pie, show the PNG export

## Example

```
month,revenue,expenses
Jan,12000,8000
Feb,15000,9000
Mar,13500,8500
```

Select `month` for X, tick `revenue` and `expenses` for Y → grouped bars with a legend, ready to download.
