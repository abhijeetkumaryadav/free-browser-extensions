# LineForge — Multi-Line Text Appender v1.0.0

Paste lines of text and transform each one: add a prefix/suffix, number
them, wrap them in quotes or HTML tags, and join them with a custom
separator. Live preview, one-click copy, optional `.txt` download.
100% local — your draft and settings persist via `chrome.storage.local`.

## Features

- Prefix / suffix per line
- Wrap each line: single/double quotes, backticks, `<li>` / `<p>` / `<span>`,
  or a custom open|close pair (e.g. `[|]`)
- Line numbering: `1.`, `1)`, zero-padded `01`, `#1`, `[1]`
- Join lines with: newline, comma, space, semicolon, pipe, or a custom separator
- Skip empty lines, trim whitespace (both toggleable)
- Live preview with line count, copy to clipboard, download as `.txt`
- Draft + settings remembered between sessions

## Install (Chrome / Edge / Opera)

1. Unzip `multi-line-cursor-text-appender.zip`
2. Open `chrome://extensions` → enable **Developer mode**
3. **Load unpacked** → select the unzipped folder

Firefox: `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → pick `manifest.json`.

## Permissions

- `storage` — persist your draft and settings locally.

No host permissions, no network calls.

## Publishing notes

- MV3, no remote code, no external assets — store-safe.
- Transform core (`transform()`) is pure and was unit-tested in Node.
