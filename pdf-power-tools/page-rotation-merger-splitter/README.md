# PageForge — PDF Rotate, Merge & Split

Rotate PDF pages, merge multiple PDFs into one, and extract page ranges — all processed **locally in your browser**. Your files never leave your device.

## Features

- **Add PDFs** — pick one or more PDF files; page counts are shown per file.
- **Merge** — combine all PDFs in list order (reorder with the arrow buttons).
- **Rotate** — rotate selected pages of one PDF by 90° / 180° / 270° (adds to any existing rotation). Page ranges like `1-3, 5` or `1-` (to the end).
- **Split** — extract a page range from one PDF into a new document.
- Output filenames are remembered between sessions.

## Install (Chrome / Edge)

1. Unzip `page-rotation-merger-splitter.zip`.
2. Open `chrome://extensions` (or `edge://extensions`).
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the unzipped folder.

## Install (Firefox)

Firefox supports Manifest V3 extensions:

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on** and choose the folder's `manifest.json`.
3. Note: `chrome.downloads` maps to `browser.downloads`; temporary add-ons unload on restart.

## Permissions

| Permission | Why |
|---|---|
| `storage` | Remembers your output filename preferences. |
| `downloads` | Saves the resulting PDF to your downloads folder. |

No host permissions, no network access, no content scripts. The extension cannot see your browsing.

## Publishing notes

- Manifest V3, no remote code. The bundled `vendor/pdf-lib.min.js` is the official pdf-lib UMD build loaded from a local file.
- For the Chrome Web Store listing you'll need: a 1280×800 promo tile, screenshots, a short + full description, and a privacy policy stating files are processed locally.
- Credit: PDF manipulation powered by [pdf-lib](https://pdf-lib.js.org/) (MIT License, © pdf-lib contributors).

## Limitations

- Encrypted/password-protected PDFs may fail to load.
- Very large PDFs (hundreds of MB) are limited by available memory.
