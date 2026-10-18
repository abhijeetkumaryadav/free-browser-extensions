# Side Panel Demo

A side-panel demo built on the **stable** `chrome.sidePanel` API — the name is a queue artifact; nothing here is experimental.

## What it does

- Click the toolbar button (or **Open side panel**) to open a persistent side panel.
- **Notes tab** — quick notes with titles, saved locally, newest first, deletable.
- **Bookmarks tab** — save the current tab in one click, or type a title + URL manually.

## Honest scope

- Uses the **STABLE** `chrome.sidePanel` API. No experimental or origin-trial APIs are involved.
- Everything is stored in `chrome.storage.local`. No network, no accounts, no sync.

## Permissions

- `sidePanel` — open and host the panel.
- `storage` — persist notes and bookmarks locally.
- `tabs` — read the current tab's title/URL when you click "Save current tab".

## Install

1. Open `chrome://extensions`, enable **Developer mode**.
2. **Load unpacked** → select this folder.
3. Click the toolbar icon → **Open side panel**.
