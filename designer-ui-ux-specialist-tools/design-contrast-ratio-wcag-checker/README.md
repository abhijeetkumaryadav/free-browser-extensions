# Contrast Ratio WCAG Checker

Check any text on a web page against WCAG contrast requirements —
pick a single text element for a detailed report, or scan the whole
page to find the worst offenders.

## Features

- **Pick text** — hover highlights elements, click any text to get its
  contrast ratio, foreground/background swatches, live sample, and
  AA/AAA pass badges for both normal and large text
- **Scan page** — analyzes visible text nodes and lists the 25 worst
  ratios, color-coded (red < 3:1, amber < 4.5:1, green passing)
- **Large-text detection** — automatically applies the looser WCAG
  thresholds (AA 3:1, AAA 4.5:1) for large text (≥24px, or ≥18.66px bold)
- **Remembers** your last check/scan across popup sessions (on-device only)

## Install

**Chrome / Edge**
1. Unzip `design-contrast-ratio-wcag-checker.zip`
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
| `activeTab` | Read the tab you invoke the extension on, only when invoked |
| `scripting` | Inject the contrast probe on demand (only after you click Pick/Scan) |
| `storage` | Remember your last check/scan locally |

No network requests. No data leaves your device. The probe is read-only —
it never modifies page content.

## Notes & limitations

- Background color is resolved by walking up the DOM to the first
  non-transparent background; semi-transparent layers, gradients, and
  background images are treated as their solid color (documented heuristic).
- Cannot inject into browser-internal pages (`chrome://`, `about:`, web stores).
- Scan is capped at 400 text nodes / top 25 offenders for performance.

## Publishing notes

- Manifest V3, no deprecated APIs.
- Privacy disclosure: no data collection of any kind.
