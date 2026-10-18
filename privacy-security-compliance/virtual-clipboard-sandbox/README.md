# Virtual Clipboard Sandbox v1.0.0

A private, on-device clipboard history manager. Every piece of text you copy
is remembered (up to the last 50), searchable, pinnable, and one click away
from being pasted again. Nothing ever leaves your device — there is no sync,
no server, no analytics.

## Features

- **Auto-capture** — real copy events on web pages are stored automatically
  (toggleable in the popup).
- **Manual capture** — "Capture selection" button, or right-click →
  *Save selection to Clipboard Sandbox*.
- **Search** across clip text and source site.
- **Pin** favorite clips so they survive the 50-clip cap.
- **Click any clip** to copy it back to the clipboard.
- **Two-step Clear** wipes everything.

## Install

**Chrome / Edge**
1. Unzip `virtual-clipboard-sandbox.zip`.
2. Open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

**Firefox**
1. Open `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on**.
2. Select the `manifest.json` inside the unzipped folder.
   (Note: temporary installs lose data on browser restart.)

## Permissions — justified

| Permission | Why |
|---|---|
| `storage` | Stores the clip history on-device. |
| `activeTab` + `scripting` | "Capture selection" reads the current tab's selected text. |
| `contextMenus` | Adds the right-click "Save selection" entry. |
| `clipboardWrite` | Click-to-copy a clip back onto the clipboard. |
| Content script on `http(s)` | Listens for `copy` events to auto-capture. Never reads keystrokes, passwords, or page content beyond the copied selection. |

## Privacy

Clipboard history is sensitive. This extension keeps everything in
`chrome.storage.local` on your machine, transmits nothing, and offers a
one-click wipe. The content script only reacts to `copy` events and never
interferes with the actual copy operation.

## Publishing notes

- Manifest V3, no remote code, no external requests — store-friendly.
- Provide a privacy policy stating all data stays on-device.
