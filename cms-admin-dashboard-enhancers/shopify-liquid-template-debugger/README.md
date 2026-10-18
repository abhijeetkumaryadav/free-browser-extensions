# Shopify Liquid Template Debugger v1.0.0

Static analyzer for Shopify Liquid templates. Paste a template and get
syntax highlighting, tag-balance validation with line numbers, a
variable/filter/block-tag inventory, and common-mistake hints — entirely
on-device. Your template is **never executed** and never leaves your machine.

## Features

- **Tag balance**: detects unclosed `{% %}` / `{{ }}`, mismatched block tags
  (`{% if %}` … `{% endfor %}`), stray closers — all with line numbers
- **Block tracking**: if/unless/for/case/capture/comment/form/paginate/tablerow
  must all be closed; `else`/`elsif`/`when` and `break`/`continue` placement checked
- **Inventory**: every variable used, every filter used (with counts),
  every block tag used
- **Common-mistake hints**: single `=` in conditions, `{{ }}` nested inside
  `{% %}`, unquoted string literals, deprecated `{% include %}` → `{% render %}`,
  empty tags
- **Syntax highlighting** of the pasted source
- Sample template button, `Cmd/Ctrl + Enter` to analyze, remembers last input

## Install

**Chrome / Edge**
1. Unzip `shopify-liquid-template-debugger.zip`
2. Open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**
3. Click **Load unpacked** and select the unzipped folder

**Firefox**
1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on** and select `manifest.json`

## Permissions

| Permission | Why |
|---|---|
| `storage` | Remembers your last pasted template locally |
| `clipboardWrite` | Reserved for copying analysis results |

No host permissions. No network access. Nothing leaves your device.

## Notes

- This is a **heuristic static analyzer**, not a Liquid interpreter: it reads
  your template as text and never executes it.
- `{% comment %}…{% endcomment %}` blocks are parsed as ordinary block tags;
  content inside them is still scanned (Liquid itself ignores it at render).

## Publishing

Manifest V3, no deprecated APIs. For the Chrome Web Store you need a one-time
$5 developer registration and 2-step verification.
