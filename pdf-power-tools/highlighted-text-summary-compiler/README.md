# SnippetStack — Highlight & Summary Compiler

Collect text selections from any web page into organized research projects, then compile them into a Markdown or plain-text summary — all **on-device**.

## Features

- **Save selections two ways**: right-click any selected text → *Save selection to SnippetStack*, or click **Save current selection** in the popup.
- **Projects** — create, rename (via new), switch, and delete research projects.
- **Snippet management** — reorder with up/down arrows, delete, per-snippet word counts, total word count.
- **Sources** — automatic deduplicated source list with clickable links.
- **Export** — download the compiled document as Markdown or `.txt`, or copy it to the clipboard.

## Install (Chrome / Edge)

1. Unzip `highlighted-text-summary-compiler.zip`.
2. Open `chrome://extensions` (or `edge://extensions`).
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the unzipped folder.

## Install (Firefox)

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on** and choose the folder's `manifest.json`.
3. Note: `chrome.*` APIs are used; Firefox supports the `chrome` namespace for these. Temporary add-ons unload on restart.

## Permissions

| Permission | Why |
|---|---|
| `storage` | Saves your projects and snippets locally. |
| `contextMenus` | Adds "Save selection to SnippetStack" to the right-click menu. |
| `activeTab` + `scripting` | Reads the current text selection only when you click "Save current selection". |

No host permissions, no network access. The extension only reads text you explicitly choose to save.

## Publishing notes

- Manifest V3, no remote code, no analytics.
- For the Chrome Web Store listing you'll need: a 1280×800 promo tile, screenshots, a short + full description, and a privacy policy stating data is stored locally only.

## Limitations

- The popup "Save current selection" button can't read `chrome://`, `edge://`, or Web Store pages (use the right-click menu there — actually the menu can't run there either; select-and-copy manually on those pages).
- Snippets are stored in `chrome.storage.local` (browser profile storage, ~10MB quota).
