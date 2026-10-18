# Memory Mesh — Shared Cross-Tab Scratchpad

A shared scratchpad that syncs notes **instantly across every open tab and window**.

## What it does

- Add titled notes from any popup — they appear in every other tab's popup within a second
- Live-sync via `chrome.storage.onChanged` — no refresh needed
- Search notes, copy to clipboard, delete individually, or clear all
- Timestamps show when each note was created
- Ctrl/Cmd+Enter saves a note from the text field

## Honest scope

- **Shared memory across your tabs — not a distributed mesh.** Notes stay in this browser's local extension storage. There is no P2P network, no cloud sync, and no server.
- 100% local. No network access, no analytics, no accounts.

## Permissions

- `storage` — save and sync notes across the browser (justified: the core feature).

## Files

- `manifest.json` — MV3 manifest
- `popup.html` / `popup.css` / `popup.js` — popup UI, styling, and sync logic
- `icons/` — generated 16/48/128 PNG icons

## Development build

Install via `chrome://extensions` → Developer mode → Load unpacked.
