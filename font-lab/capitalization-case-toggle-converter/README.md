# CaseShift — Text Case Converter (v1.0.0)

Convert text between 10 case styles — all locally in your browser, no network calls, no data leaves the device.

## Case styles
- **UPPER CASE** / **lower case**
- **Title Case** (first letter of each word)
- **Sentence case** (first letter of each sentence)
- **aLtErNaTiNg** (letter-by-letter alternation)
- **tOGGLE** (swap every letter's case)
- **camelCase** / **PascalCase** / **snake_case** / **kebab-case**

## Install
**Chrome / Edge / Opera:**
1. Download and unzip `capitalization-case-toggle-converter.zip`
2. Go to `chrome://extensions` (or `edge://extensions`)
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** and select the unzipped folder

**Firefox:** MV3 support exists in recent versions; load via `about:debugging#/runtime/this-firefox` → *Load Temporary Add-on* → select `manifest.json`.

## Permissions (justified)
- `storage` — remembers your last-used case style. Nothing else is stored.

## Privacy
All conversions run synchronously in the popup. No network requests, no analytics, no data collection.

## Publishing notes
- Manifest V3, no remote code, single minimal permission — store-friendly.
- Works offline immediately after install.
