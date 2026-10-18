# NovelPress — Light Novel EPUB Formatter (v1.0.0)

Paste or type your light-novel text **chapter by chapter**, set a title and author,
and export a **structurally valid `.epub`** — generated entirely on-device with a
hand-written stored-entry ZIP writer (`mimetype` first, proper OPF / NCX /
container XML), downloaded via `chrome.downloads`.

> **Honest scope:** best-effort plain-text formatting. Blank lines become
> paragraphs; special characters are XML-escaped. Complex layouts, images, and
> paywalled content are out of scope.

## Install

**Chrome / Edge**
1. Unzip the package.
2. Go to `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

**Firefox**
1. Go to `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on**.
2. Select `manifest.json` inside the folder.

## Permissions

| Permission | Why |
|---|---|
| `storage` | Saves your draft (title, author, chapters) on-device. |
| `downloads` | Saves the generated `.epub` file when you click Export. |

No network calls are made — ever.

## Features

- Chapter-by-chapter editor: add, rename, reorder (up/down), delete
- Live word counts per chapter + total
- Title / author metadata with safe filename generation
- One-click EPUB export; verified structure:
  - `mimetype` first entry, uncompressed (EPUB spec requirement)
  - `META-INF/container.xml`, `OEBPS/content.opf`, `OEBPS/toc.ncx` all parse as XML
  - Per-chapter XHTML with escaped text, blank-line paragraph breaks
- Draft auto-saves as you type (debounced) and on popup close

## Publishing notes

- Manifest V3, no remote code, no analytics, no external fonts.
- Minimal permissions (`storage` + `downloads`) — easy privacy review.
