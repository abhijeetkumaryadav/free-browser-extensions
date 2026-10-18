# MacroReact — Emoji Hotkey Binder

Assign a favorite emoji to each of 5 macro slots, then press its keyboard
hotkey anywhere to copy that emoji to the clipboard.

## How it works
- Hotkeys are bound through the standard `chrome.commands` API
  (defaults: `Ctrl+Shift+1` … `Ctrl+Shift+5`).
- Change them at `chrome://extensions/shortcuts`.
- The background service worker copies via an offscreen document
  (service workers cannot access the clipboard directly).
- **Hotkey-to-copy only**: the extension never listens to keystrokes,
  has no content scripts, and makes no network calls.

## Firefox note
The `offscreen` clipboard path is Chrome/Edge-only. On Firefox the popup's
per-slot **Copy** buttons always work; hotkeys trigger the same flow and the
popup reports the result.

## Install
1. Unzip the package.
2. Open `chrome://extensions` → Developer mode → Load unpacked → select folder.

## Permissions
- `storage` — saves your 5 macro emoji.
- `offscreen` — clipboard access from the background hotkey handler.

## Publishing notes
- Manifest V3, zero network, no remote code.
