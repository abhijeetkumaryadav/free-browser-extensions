# MetaScrub — Metadata Privacy Stripper v1.0.0

Strip hidden metadata from **copies** of your files before sharing — author names, timestamps, EXIF data. Your originals are never modified, and everything runs 100% on-device.

## Honest scope

| File type | What is detected | What stripping does |
|---|---|---|
| **PDF** | Document info: title, author, subject, keywords, creator, producer, creation/modification dates, custom keys | Deletes **every key** of the PDF `/Info` dictionary via pdf-lib |
| **JPG / PNG / WebP** | Dimensions, MIME type (EXIF is not parsed — see below) | Re-encodes through `<canvas>`, which drops EXIF/XMP segments. JPEG/WebP re-encoded at quality 0.92 |
| **TXT** | Line/character counts (plain text has no embedded metadata) | Normalizes line endings, trims trailing whitespace |

- EXIF is **not parsed or displayed** — the strip works by re-encoding, which is the reliable way to remove it without a heavy EXIF library.
- Encrypted PDFs fail to open with a clear message.
- Output is always a new download (`<name>-clean.<ext>`); the original file is untouched.

## Install

**Chrome / Edge:** unzip → `chrome://extensions` → enable *Developer mode* → *Load unpacked* → select the folder.
**Firefox:** `about:debugging` → *This Firefox* → *Load Temporary Add-on* → select `manifest.json`.
**Opera:** `opera://extensions` → enable *Developer mode* → *Load unpacked*.

## Use

1. Drop a file (or click to choose).
2. Review the detected metadata table (BEFORE).
3. Click **Strip metadata** — the AFTER table confirms what was removed.
4. Click **Download clean copy**.

## Permissions

| Permission | Why |
|---|---|
| `storage` | Remembers UI preferences on-device. |
| `downloads` | Saves the clean copy you explicitly request. |

No host permissions, no content scripts, no network calls of any kind. PDF handling uses **pdf-lib 1.17.1 (MIT)**, bundled locally in `vendor/` — never loaded from a CDN (remote code is not allowed in Manifest V3).

## Publishing notes

- Manifest V3, no deprecated APIs.
- Minimal, justified permissions (`storage`, `downloads`).
- Privacy: zero data collection; files never leave the device.
- Category: Productivity.
