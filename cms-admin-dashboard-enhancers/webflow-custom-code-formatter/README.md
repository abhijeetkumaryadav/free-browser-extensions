# Webflow Custom Code Formatter v1.0.0

Format, validate and minify HTML, CSS and JavaScript for Webflow custom code
embeds — entirely on-device. Your code is never executed, uploaded or
transmitted anywhere.

## Features

- **Beautify** HTML (tag-aware indentation), CSS and JS (string/comment-aware
  brace indentation) with one click — or `Cmd/Ctrl + Enter`
- **Minify** with a string-aware whitespace collapser (safe for quoted strings)
- **Validate**: unclosed/mismatched HTML tags with line numbers; unbalanced
  braces/parens/brackets and unterminated strings or block comments in CSS/JS
- **Auto-detect** language mode, plus manual HTML / CSS / JS tabs
- Copy output, paste from clipboard, remembers your last input and mode

## Install

**Chrome / Edge**
1. Unzip `webflow-custom-code-formatter.zip`
2. Open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**
3. Click **Load unpacked** and select the unzipped folder

**Firefox**
1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on** and select `manifest.json`

## Permissions

| Permission | Why |
|---|---|
| `storage` | Remembers your selected mode and last input locally |
| `clipboardWrite` | Copy formatted output to the clipboard |

No host permissions. No network access. Nothing leaves your device.

## Notes

- The JS beautifier is a heuristic indenter, not a full parser — it handles
  everyday scripts well but very exotic syntax may indent imperfectly.
- Pasted code is analyzed as text only; it is **never executed**.

## Publishing

Manifest V3, no deprecated APIs. For the Chrome Web Store you will need a
one-time $5 developer registration and 2-step verification; disclose the
`clipboardWrite` permission in the privacy section.
