# TableSnatch — Table to CSV Converter

Detect every HTML `<table>` on the current page, preview it, then copy it as
CSV or download a `.csv` file — one click per table.

## Features

- On-demand page scan (nothing runs until you click "Scan")
- Table cards show label, dimensions (rows × columns), and a live preview
- Per-table **Copy CSV** and **Download CSV** actions
- Options: delimiter (comma / semicolon / tab / pipe) and "first row is header"
- Options persist on-device; labels come from `<caption>`, `aria-label`, or a
  nearby heading

## How it works

- `scanner.js` is injected into the active tab only when you click Scan
  (`scripting.executeScript`, read-only DOM analysis).
- `popup.js` builds RFC 4180 CSV (proper quoting/escaping) and either writes
  it to the clipboard or downloads it via the `downloads` API.
- Nothing leaves your machine; no network calls at all.

## Honest limitations

- Only real HTML `<table>` elements are detected. Tables drawn in `<canvas>`,
  built inside closed shadow DOM, or rendered as divs are not found.
- `colspan` is expanded with empty cells; `rowspan` is not expanded (a known,
  documented simplification — affected cells align to their row's first
  columns).
- Cannot run on `chrome://`, `edge://`, or browser store pages (platform
  restriction).

## Install

**Chrome / Edge**
1. Download and unzip `tabular-data-csv-auto-converter.zip`.
2. Open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

**Firefox**
1. Open `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on**.
2. Select `manifest.json`. (Temporary installs reset on browser restart; for
   permanent install the add-on must be signed via addons.mozilla.org.)

## Permissions

| Permission | Why |
|---|---|
| `activeTab` | Access the tab you clicked Scan on |
| `scripting` | Inject the read-only table scanner into that tab |
| `storage` | Remember your delimiter/header preferences, on-device only |
| `downloads` | Save the exported CSV file |

Host access (`http://*/*`, `https://*/*`) allows scanning web pages. The
extension makes no network requests and collects no data.

## Publishing notes

- Chrome Web Store: single-purpose (table → CSV export), no remote code, no
  data collection — declare "no data collected" in the privacy section.
- Edge Add-ons: same package works as-is.
- Firefox: `downloads` and `scripting` are supported; requires a signed build
  through AMO for permanent installation.
