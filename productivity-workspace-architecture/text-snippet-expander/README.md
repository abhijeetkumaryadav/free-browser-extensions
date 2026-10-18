# Text Snippet Expander v1.0.0

Type a trigger like `;sig` in any text field and it instantly expands into your saved snippet — signatures, addresses, canned replies, code templates. Put `{cursor}` in a snippet to land the caret exactly where you want it after expansion.

## Features

- **Trigger expansion** — type a trigger + Tab (or Space/Enter, your choice) and it becomes the snippet. Word-boundary matching only: `;sig` expands, `x;sig` does not.
- **`{cursor}` placement** — the caret jumps to the marker position after expansion.
- **Works everywhere** — inputs, textareas, and contenteditable editors (Gmail compose, Notion, etc.).
- **Snippet library** — add, edit, delete, import/export as JSON.
- **Privacy-first** — the content script only compares the word before the caret against your trigger list. It never records, stores, or transmits keystrokes. Everything stays on-device.

## Install

### Chrome / Edge
1. Unzip `text-snippet-expander.zip`.
2. Go to `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
3. **Load unpacked** → select the unzipped folder.

### Firefox
1. Go to `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → pick `manifest.json`.

### Opera
Same as Chrome via `opera://extensions` with Developer mode enabled.

## Permissions (justified)

| Permission | Why |
|---|---|
| `storage` | Save your snippet library and settings on-device. Nothing leaves your computer. |

The content script runs on `http(s)` pages solely to watch for your triggers in text fields. It has no network access and sends nothing anywhere. The export feature downloads a file only when **you** click Export.

## Publishing notes

- MV3, no deprecated APIs.
- Privacy practice to declare (Chrome Web Store): "Keystroke text is compared locally against user-defined triggers; no keystroke or text data is collected, stored, or transmitted."
- Screenshots: popup library with a couple of snippets; an input field mid-expansion.
- Demo: GIF of typing `;sig` + Tab → signature appears.
