# ColonPick — :shortcode: Emoji Picker

A fast popup emoji picker with `:shortcode:` search. Type part of a shortcode (e.g. `:fire:` or `thumbs`), click an emoji to copy it — or flip the mode toggle to copy the `:shortcode:` text instead. Your recent picks are remembered locally.

## Honest scope

- **Popup picker only.** ColonPick does NOT inject autocomplete into web pages or listen to your keystrokes. You search in the popup, click, then paste anywhere yourself.
- **Zero network.** The emoji dictionary (~120 entries) is bundled locally. No accounts, no analytics.

## Features

- Curated offline dictionary (~120 emoji) with shortcodes + keywords
- Live `:shortcode:` search with hover tooltips showing the code
- Click to copy the emoji; toggle to copy `:shortcode:` text instead
- Recent picks row (last 16), persisted in `chrome.storage.local`
- Clipboard fallback if the Clipboard API is denied

## Install

1. Unzip the package (or use the folder directly).
2. Open `chrome://extensions` (Edge: `edge://extensions`), enable **Developer mode**.
3. **Load unpacked** → select the extension folder.
4. Pin ColonPick to the toolbar.

Firefox: `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → `manifest.json`.

## Permissions

- `storage` — remembers recent picks and the copy mode. Nothing else.

## Publishing notes

- Manifest V3, no remote code, no host permissions, no content scripts — popup-only tool.

## Files

- `manifest.json` — MV3 manifest
- `popup.html` / `popup.css` / `popup.js` — picker UI + bundled dictionary
- `icons/` — 16/48/128 PNG icons
