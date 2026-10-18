# PagePress — Article to EPUB Exporter

Extract the current page's article text (or your selected text) and export it as a valid **.epub** ebook — title/author editable, word-count preview, one-click download. Everything happens on-device.

## Install

**Chrome / Edge:**
1. Download and unzip `ebook-epub-format-exporter.zip`
2. Open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**
3. Click **Load unpacked** and select the unzipped folder

**Firefox:** The EPUB builder itself is portable JavaScript, but this package uses Manifest V3 with `chrome.scripting` + `chrome.downloads` in Chromium form; a Firefox port would need `browser.*` namespace tweaks and is not included.

## Usage
1. Open any article page (or select text on a page).
2. Click the PagePress toolbar button.
3. Choose **Page article** or **My selection**, edit Title/Author.
4. Click **Extract content** → preview word count and excerpt.
5. Click **Export .epub** → choose where to save.

## Permissions (justified)
| Permission | Why |
|---|---|
| `activeTab` | Read the title/URL of the tab you clicked on |
| `scripting` | Run the text-extraction function in the current tab, only when you click Extract |
| `downloads` | Save the generated `.epub` file you requested |
| `storage` | Remember your last Title/Author and source choice |

## Publishing notes
- Manifest V3, no remote code, no network calls at all.
- The ZIP writer stores entries uncompressed (valid per EPUB spec; `mimetype` is first entry).
- Honest scope: best-effort export — complex layouts, paywalls, and script-rendered apps may not convert cleanly. Stated in the popup.
