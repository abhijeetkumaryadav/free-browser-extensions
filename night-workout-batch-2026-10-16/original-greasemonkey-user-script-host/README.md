# Snippet Injector — Personal User Scripts v1.0.0

A personal snippet injector: write, save, and inject your own JavaScript into the active tab.

## Honest scope

Chrome MV3 blocks arbitrary userscript hosting (like the original Greasemonkey model), so this is a **personal snippet injector**, not a userscript manager:

- Stores **your own** snippets in `chrome.storage.local`.
- Injection happens **only on explicit click** via `chrome.scripting.executeScript` into the active tab.
- **Warning:** injected code runs with page privileges — it can read and modify the page. Review every snippet before injecting. Only run code you wrote or fully trust.
- Internal pages (`chrome://`, Web Store, etc.) are off-limits by design.

## Features

- Editor with name + code fields; save, edit, delete snippets.
- One-click "Inject into this tab" for the editor contents or any saved snippet.
- Snippet list shows name + character count.
- Zero network calls.

## Permissions

- `storage` — persist snippets locally.
- `activeTab` + `scripting` — inject into the active tab on your explicit click.

## Files

- `manifest.json` — MV3 manifest
- `popup.html` / `popup.css` / `popup.js` — popup UI and injection logic
- `icons/` — generated PNG icons (16/48/128)
- `README.md` — this file
