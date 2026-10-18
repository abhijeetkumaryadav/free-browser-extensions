# View History Heatmapper v1.0.0

A GitHub-style activity heatmap of your browsing over the past 30 days — hour by day — with total visits, peak hour, and peak day stats.

## Features
- 30-day × 24-hour heatmap grid with orange intensity levels
- Hover any cell for an exact visit count and timestamp
- Stats: total visits, peak hour, peak day
- All computation happens on-device; nothing is stored or sent anywhere

## Install (Chrome / Edge)
1. Unzip `view-history-heatmapper.zip`
2. Open `chrome://extensions` (or `edge://extensions`)
3. Enable **Developer mode**
4. Click **Load unpacked** and select the unzipped folder

## Install (Firefox)
1. Unzip the package
2. Open `about:debugging#/runtime/this-firefox`
3. Click **Load Temporary Add-on** and choose `manifest.json`
   (temporary add-ons unload on browser restart)

## Permissions
| Permission | Why it's needed |
|---|---|
| `history` | Read local browsing history to build the heatmap |

That's the only permission. No network access, no storage, no analytics.

## Publishing notes
- Manifest V3, no deprecated APIs
- Single, clearly-justified permission — store-review friendly
- Icons: generated 16/48/128 PNGs included
