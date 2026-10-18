# SVG Export Grabber

Find every SVG on the active page — inline `<svg>` elements and `<img>` SVGs — with live previews, one-click copy, and individual or batch download.

## Features

- **Scan page** injects a read-only scanner into the active tab (only when you click)
- Lists inline SVGs (serialized markup) and SVG images (data: or remote URLs) with dimensions
- **Live previews** on a checkerboard background; SVG markup sanitized before preview (scripts stripped, event handlers removed)
- **Copy** inline SVG code to clipboard; **Download** individual SVGs or **Download all** (sequential, to avoid browser throttling)
- Remote SVGs download via `chrome.downloads` directly from their URL

## Install

1. Unzip `svg-export-grabber.zip`
2. Open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**
3. Click **Load unpacked** and select the unzipped folder
4. Firefox: `about:debugging` → This Firefox → Load Temporary Add-on → choose `manifest.json`

## Permissions

| Permission | Why |
|---|---|
| `activeTab` | Scan the tab you are viewing |
| `scripting` | Inject the read-only SVG scanner on demand |
| `storage` | Reserved for future preferences (currently unused) |
| `downloads` | Save exported `.svg` files |
| `clipboardWrite` | Copy SVG markup to clipboard |

No host permissions beyond the active tab, no network calls by the extension itself (downloads of remote SVGs go straight from the browser to the source URL).

## Publishing notes

- MV3, no remote code, no analytics — declare "no data collected" in store privacy disclosures
- Cannot scan `chrome://`, `edge://`, `about:`, or web-store pages (browser restriction, not a bug)
