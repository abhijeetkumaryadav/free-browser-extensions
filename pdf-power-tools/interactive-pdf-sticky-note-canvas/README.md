# StickyNote PDF — Annotate Your PDFs

Add colorful sticky-note annotations to **your own** PDF files and download the annotated copy. Everything runs locally in the extension — files never leave your device.

## What it does

1. **Pick a PDF** — click "Choose PDF file" or drag & drop it onto the dropzone. The file is kept in memory only; it is never uploaded.
2. **Browse pages** — the extension reads the real page dimensions (via the locally bundled pdf-lib) and shows a schematic, proportionally-correct page preview.
3. **Click to place a note** — click anywhere on the preview to drop a sticky note. Type your text, pick one of 5 colors, save.
4. **Manage notes** — notes are listed per page; click one to edit, or delete it. Notes persist per document (matched by name + size + modification date) in `chrome.storage.local`, so they're still there when you reopen the same file.
5. **Download annotated PDF** — draws each note onto a copy of your PDF as a colored sticky square plus wrapped note text, and downloads it as `<name>-annotated.pdf`. Your original file is untouched.

## Honest scope

- This works on **your own files** that you open in the extension. It does not annotate PDFs already open in browser tabs (extensions can't script the built-in PDF viewer).
- The schematic preview is proportional but not a rendered page — click positions map to real PDF coordinates.
- Note text uses a standard font (Helvetica); complex Unicode scripts may not render in the exported text.

## Install

**Chrome / Edge:**
1. Unzip the package.
2. Go to `chrome://extensions` (or `edge://extensions`).
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the unzipped folder.

**Firefox:** this version targets Chromium. Firefox support would need the `browser` namespace polyfill for `chrome.downloads` — contributions welcome.

## Permissions (justified)

| Permission | Why |
|---|---|
| `storage` | Persist your notes per document on-device. |
| `downloads` | Save the annotated PDF when you click Download. |

No host permissions. No network calls. The bundled `vendor/pdf-lib.min.js` (pdf-lib 1.17.1, MIT) is loaded from disk — never from a CDN.

## Publishing notes

- Manifest V3, no deprecated APIs.
- pdf-lib is bundled locally (allowed); credit pdf-lib (MIT © 2019 Andrew Dillon) in the store listing.
- Privacy disclosure: no data collected, transmitted, or shared — everything stays on-device.
