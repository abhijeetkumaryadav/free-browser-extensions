# CBZ Reader — Local Comic Book Viewer

Open local `.cbz` comic files and page through them in a full tab: next/previous buttons, arrow keys, thumbnail strip, fullscreen, and per-file reading position saved locally.

**Honest scope: CBZ only — no CBR/RAR support.** CBZ files are plain ZIP archives; this reader parses the ZIP central directory itself and decompresses entries with the browser's built-in `DecompressionStream('deflate-raw')` (deflate) or uses stored entries as-is. Files are never uploaded; everything happens on your device.

## Features

- Open any `.cbz` (or `.zip`) file containing comic pages
- Pages sorted naturally (`page2` before `page10`)
- Prev/next buttons + left/right arrow keys + clickable thumbnails
- Fullscreen toggle
- Remembers your page per file name (`chrome.storage.local`)
- 400-page cap per file for safety

## Limitations

- CBR (RAR) files are not supported and won't open
- Archives using data descriptors or exotic compression methods are rejected with a clear message

## Files

- `manifest.json` — MV3, permissions: `storage` only
- `popup.html/css/js` — launcher popup
- `reader.html/css/js` — full-tab reader with the ZIP parser
- `icons/` — generated PNG icons (16/48/128)

## Privacy

Zero network calls. The file you open stays on your machine.
