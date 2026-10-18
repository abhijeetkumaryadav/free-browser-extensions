# Component Class Extractor

Pick any element on a web page and extract its class list (Tailwind or otherwise)
plus key computed styles into a copyable component snippet.

## Features

- **Pick element on page** — hover highlights elements, click to select, `Esc` to cancel
- **HTML tab** — element markup with its `id` and class list
- **CSS tab** — key computed styles (layout, typography, color, borders) as a CSS block
- **Tree tab** — compact tag/class tree when "With children" depth is selected
- **Depth control** — element only, or include a depth-limited child tree
- **Copy snippet** — one click to clipboard
- **Remembers** the last extraction across popup sessions (on-device only)

## Install

**Chrome / Edge**
1. Unzip `component-tailwind-class-extractor.zip`
2. Open `chrome://extensions` (or `edge://extensions`)
3. Enable **Developer mode**
4. Click **Load unpacked** and select the unzipped folder

**Firefox**
1. Unzip the package
2. Open `about:debugging#/runtime/this-firefox`
3. Click **Load Temporary Add-on** and choose `manifest.json`

## Permissions (minimal, justified)

| Permission | Why |
|---|---|
| `activeTab` | Read the tab you click the extension on, only when invoked |
| `scripting` | Inject the picker overlay on demand (only after you click "Pick element") |
| `storage` | Remember your last extraction locally |

No network requests. No data leaves your device. The picker is read-only —
it never modifies page content.

## Notes & limitations

- Cannot inject into browser-internal pages (`chrome://`, `about:`, web stores) —
  the popup shows a friendly error there.
- "With children" trees are depth- and count-limited to keep snippets readable.
- Computed-style extraction skips default/no-op values to reduce noise.

## Publishing notes

- Manifest V3, no deprecated APIs.
- Privacy disclosure: no data collection of any kind.
