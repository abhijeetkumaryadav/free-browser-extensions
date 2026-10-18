# MarkPad — Floating WYSIWYG Markdown Pad

A distraction-free, local-first markdown editor for your browser. Write with a real
WYSIWYG toolbar (bold, italic, headings, quotes, lists, code, links), flip to a live
Markdown source view, and export your work as `.md` or standalone `.html`.

**Everything stays on your device.** There are no accounts, no network calls, and no
tracking — drafts autosave to `chrome.storage.local`.

## Install

**Chrome / Edge / Opera**
1. Download and unzip `markdown-floating-wysiwyg-pad.zip`.
2. Open `chrome://extensions` (or `edge://extensions`).
3. Enable **Developer mode** (top right).
4. Click **Load unpacked** and select the unzipped folder.

**Firefox**
1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on** and select `manifest.json`.
   (Temporary installs are removed when Firefox restarts.)

## Usage

- Click the toolbar icon → **Open editor** to launch the full-page editor in a new tab.
- Format with the toolbar or shortcuts (`Ctrl/Cmd+B`, `Ctrl/Cmd+I`).
- Toggle **Write / Markdown** to see and edit the live Markdown source.
- **.md** / **.html** buttons download your document; **New** starts over (with confirm).
- Word count and save status live in the status bar.

## Permissions

| Permission | Why |
|---|---|
| `storage` | Autosaves your draft locally. Nothing else. |

No host permissions, no content scripts, no network access.

## Notes for publishing

- Manifest V3, no remote code, no analytics — store-review friendly.
- Firefox: the extension works as a temporary add-on; for AMO distribution no code
  changes are needed (MV3 is supported).
- Suggested store category: Productivity.
