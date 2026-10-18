# Podcast Enclosure Sniffer

Finds podcast audio links and RSS enclosures on the current page — **lists only, never downloads anything**.

## How it works

1. Click the toolbar icon and press **Scan this page**.
2. The extension injects a read-only scanner into the active tab (explicit click only)
   and collects:
   - Audio file links (`mp3`, `m4a`, `aac`, `ogg`, `opus`, `wav`, `flac`)
   - `<audio>` elements with a source
   - Podcast RSS/Atom feed links
3. Each result shows a format badge, file name, and **Open link** / **Copy URL** actions.

## Honest scope

- **Lists only.** Nothing is downloaded, fetched, or played by the extension.
- **Read-only scan.** The page DOM is never modified.
- **No network calls.** Only opens links in new tabs when *you* click them.
- Browser-internal pages (`chrome://`, web store) cannot be scanned; the popup tells you so.

## Files

- `manifest.json` — Manifest V3
- `popup.html` / `popup.css` / `popup.js` — popup UI
- `content.js` — read-only page scanner (injected on explicit click)
- `icons/` — generated PNG icons
