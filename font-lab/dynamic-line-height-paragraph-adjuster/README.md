# LineEase — Paragraph Line-Height Adjuster

Accessibility tool: adjust the line-height of paragraphs on the current page
with a slider (1.0–2.5), plus a live preview and one-click restore.

## What it does

- **Toggle** applies the chosen line-height to the current tab only.
- **Slider (1.0–2.5):** drag to live-adjust while enabled; the popup shows a
  live preview paragraph at the same value.
- Targets text containers (`p`, `li`, `blockquote`, `figcaption`, …) — page
  layout and headings are left alone.
- **Restore original** removes the injected stylesheet exactly.
- The popup probes the tab on open and shows whether an override is active.

## Install

1. Unzip this package anywhere.
2. Open `chrome://extensions` (or `edge://extensions`).
3. Enable **Developer mode**, click **Load unpacked**, and select the unzipped folder.

Firefox: `about:debugging` → This Firefox → Load Temporary Add-on → pick
`manifest.json`.

## Permissions

| Permission | Why |
|---|---|
| `activeTab` | Touch the page you're looking at, only on your explicit action |
| `scripting` | Inject the line-height stylesheet on your toggle/restore |
| `storage` | Remember your value + toggle state on-device |

No network calls. No data leaves your device.

## Honest limits

- Cannot run on `chrome://`, `edge://`, or the Web Store pages (browser restriction).
- Unitless line-height scales with each element's own font size — a deliberately
  safe, standard approach.

## Publishing notes

- Manifest V3, no remote code, minimal permissions — store-safe.
- Single purpose, clearly labeled accessibility helper.
