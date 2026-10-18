# CleanSweep — PDF Annotation Cleaner v1.0.0

Remove annotations, stamps, highlights and comments from **your own** PDF files — all processed 100% on-device.

## Honest scope

- ✅ Removes **annotations**: comments, sticky notes, stamps, highlights, underlines, free-text callouts — anything stored in a page's `/Annots` array.
- ❌ **Cannot** remove baked-in watermarks or text printed into the page content itself. Those are part of the page's drawing commands, not annotations.
- ❌ Cannot unlock encrypted PDFs (they fail to open with a clear message).
- Your original file is never modified — the cleaned result is saved as a new download (`<name>-cleaned.pdf`).

## Install

**Chrome / Edge:** unzip → `chrome://extensions` → enable *Developer mode* → *Load unpacked* → select the folder.
**Firefox:** `about:debugging` → *This Firefox* → *Load Temporary Add-on* → select `manifest.json`.
**Opera:** `opera://extensions` → enable *Developer mode* → *Load unpacked*.

## Use

1. Click the dropzone (or drag & drop) to choose a PDF.
2. Expand pages to see every annotation with its type, author and text.
3. Tick annotations and click **Remove selected**, or **Remove all**.
4. Click **Download cleaned PDF** to save the result.

## Permissions

| Permission | Why |
|---|---|
| `storage` | Remembers UI preferences (e.g. last used options) on-device. |
| `downloads` | Saves the cleaned PDF you explicitly request. |

No host permissions, no content scripts, no network calls of any kind. PDF parsing is done with **pdf-lib 1.17.1 (MIT)**, bundled locally in `vendor/` — never loaded from a CDN (remote code is not allowed in Manifest V3).

## Publishing notes

- Manifest V3, no deprecated APIs.
- Minimal, justified permissions (`storage`, `downloads`).
- Privacy: zero data collection; files never leave the device.
- Category: Productivity.
