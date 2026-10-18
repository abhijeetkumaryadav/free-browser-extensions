# ScratchCode — Distraction-Free Code Scratchpad

A minimal, local-first scratchpad for code. Jot snippets, notes, and experiments in
a calm full-page editor with line numbers, lightweight regex-based syntax
highlighting (JavaScript, Python, CSS), multiple named scratchpads, autosave, and
one-click file download.

**Everything stays on your device.** No accounts, no network calls, no tracking —
scratchpads autosave to `chrome.storage.local`.

> Highlighting is a lightweight regex tokenizer (comments, strings, numbers,
> keywords) — not a full parser. It's labeled as such in the UI.

## Install

**Chrome / Edge / Opera**
1. Download and unzip `distraction-free-code-scratchpad.zip`.
2. Open `chrome://extensions` (or `edge://extensions`).
3. Enable **Developer mode** (top right).
4. Click **Load unpacked** and select the unzipped folder.

**Firefox**
1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on** and select `manifest.json`.
   (Temporary installs are removed when Firefox restarts.)

## Usage

- Click the toolbar icon → **Open scratchpad** for the full-page editor.
- Sidebar: switch between scratchpads, `+` creates a new one.
- Header: rename the pad, pick a language (JS / Python / CSS / plain), download
  the pad as a `.js` / `.py` / `.css` / `.txt` file, or delete it.
- `Tab` inserts two spaces. Everything autosaves as you type.

## Permissions

| Permission | Why |
|---|---|
| `storage` | Autosaves your scratchpads locally. Nothing else. |

No host permissions, no content scripts, no network access.

## Notes for publishing

- Manifest V3, no remote code, no analytics — store-review friendly.
- Suggested store category: Developer Tools.
