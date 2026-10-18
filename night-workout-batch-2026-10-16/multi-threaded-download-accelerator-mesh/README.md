# Download Queue
*(source folder: `multi-threaded-download-accelerator-mesh`)*

A personal download queue. Add URLs, track progress, pause/resume/remove them, and keep a completed-downloads history.

## Honest label (shown in the popup)

The original name promised "multi-threaded download acceleration mesh" — **that does not exist here**. This is a **simple sequential queue** built on `chrome.downloads`:

- **NOT multi-threaded.** Files download exactly as the browser normally downloads them, one per URL you add.
- **NOT a mesh.** No distributed anything — no peers, no swarms, no P2P.
- **User-triggered only.** Nothing downloads until you add a URL. No auto-fetching, no batch scraping.

## What it does

- **Add a URL** (http/https only) → the service worker starts it via `chrome.downloads.download` and stores it in the queue.
- **Progress tracking** — live % bars refreshed every second from the downloads API; shows the real saved filename once the browser knows it.
- **Pause / Resume** — per download, via `chrome.downloads.pause` / `.resume`.
- **Retry** — failed items can be re-started.
- **Remove** — cancels the download, erases it from the browser's download history, and deletes the queue entry.
- **Completed history** — last 50 completed downloads with timestamps; "Clear history" wipes the list.

## Permissions

- `downloads` — start, pause, resume, cancel, and track downloads the user queued.
- `storage` — persist the queue and history locally.

## Files

- `manifest.json` — MV3 manifest with a service worker.
- `popup.html` / `popup.css` / `popup.js` — UI and queue logic.
- `background.js` — service worker: starts downloads from popup messages and records `chrome.downloads.onChanged` transitions into storage.
- `icons/` — generated 16/48/128 PNG icons.
- `README.md` — this file.

## Validation

- `node --check` on `popup.js` and `background.js`.
- `manifest.json` parses, MV3, permissions minimal.
- Not tested in a live browser (development build).
