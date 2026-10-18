# EmojiVault — Emoji History Vault v1.0.0

An emoji vault with a built-in picker. Click any emoji in the picker to copy
it — every copy is logged to your vault automatically with a timestamp.
The **Import from clipboard** button reads your clipboard once (explicit click,
popup focused) and logs any emoji it finds.

## Honest scope

This extension **cannot read your system clipboard in the background**.
Browsers do not allow that. The vault only ever records emoji you copy
*inside this extension* (picker clicks or the Import button). Nothing is
captured silently — there is no clipboard snooping.

## Features

- Searchable emoji picker (~110 emoji, 7 categories), click-to-copy.
- Vault: most-recent-first history with timestamps and source labels.
- Vault search, click any entry to re-copy it (bumps to top).
- Per-entry delete, clear-all, 500-entry cap, all in `chrome.storage.local`.

## Install

1. Unzip the package (or `Load unpacked` on the folder).
2. Open `chrome://extensions` (Chrome/Edge) or `about:debugging#/runtime/this-firefox` (Firefox).
3. Enable **Developer mode**.
4. **Load unpacked** → select the `clipboard-emoji-history-vault` folder.
5. Pin EmojiVault and click the toolbar icon.

## Permissions

- `storage` — persists your vault locally. No other permission is requested.
  Clipboard access uses the standard Clipboard API on explicit user clicks only.

## Publishing notes

- Manifest V3, no content scripts, no host permissions, no remote code.
- Icons are generated PNGs (16/48/128).
- Safe for Chrome Web Store / Edge Add-ons / Firefox Add-ons submission.
