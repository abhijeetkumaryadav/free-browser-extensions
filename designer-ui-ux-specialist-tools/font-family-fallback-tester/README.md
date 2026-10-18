# FontStack Lab — Font Family Fallback Tester

Test font stacks against the fonts actually installed on your device. Type
sample text, browse candidate stacks with live previews, and see per-font
detection status — which fonts resolve, which fall through, and which generic
family the browser will ultimately use.

## Features

- **5 curated preset stacks** — system stack, classic sans, editorial serif,
  code mono, humanist.
- **Canvas-based detection** — the same measurement technique trackers use:
  a probe string is rendered with `<font>, <fallback>` across three
  fallbacks and compared against baselines. A width delta means installed.
- **Per-font status chips** — green = installed on this device, cyan =
  generic family (always available), gray = not installed.
- **Live previews** — your sample text rendered in each stack's real CSS
  `font-family`, plus a "resolves to …" verdict per stack.
- **Custom stacks** — add your own comma-separated stacks, persisted
  on-device; one-click copy of the CSS `font-family` declaration.

## Install (developer / unpacked)

1. Unzip `font-family-fallback-tester.zip`.
2. Open `chrome://extensions` (Edge: `edge://extensions`).
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the unzipped folder.
5. Firefox: `about:debugging` → This Firefox → Load Temporary Add-on →
   select `manifest.json`.

## Permissions

| Permission | Why it is needed |
|---|---|
| `storage` | Persists your custom stacks on this device only. |

No host permissions, no network calls, no analytics. Detection runs
entirely in the popup's own canvas; nothing is transmitted anywhere.

## Publishing notes

- Manifest V3, no deprecated APIs.
- Minimal permission set (`storage` only) — low review friction on the
  Chrome Web Store and Edge Add-ons.
- Note: detection reflects fonts visible to the browser's font-matching on
  the current machine; results can differ across devices, which is exactly
  what the tool is for.
