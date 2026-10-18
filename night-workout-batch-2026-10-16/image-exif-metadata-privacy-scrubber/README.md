# EXIF Scrubber — Metadata Privacy Cleaner

See what metadata your photos carry, then strip it all away with one click.

## What it does

- Upload one or more images (JPEG or PNG).
- For JPEGs, it **parses the EXIF block locally** (in your browser, nothing uploaded) and shows a summary of detected tags — camera make/model, date taken, GPS presence, orientation, etc.
- **Scrub & download all** re-encodes every image via canvas at full resolution, which drops **every** metadata chunk (EXIF, XMP, IPTC, PNG text chunks).
- Your original files are **never modified** — only new `*_clean.jpg/png` copies download.

## Honest scope

- Shows a summary of the most common EXIF tags, not a byte-level forensic dump.
- Scrubbing is canvas re-encoding: metadata is gone, but JPEG quality is controlled by the quality slider.
- 100% local. Zero network calls.

## Install

1. Open `chrome://extensions`, enable **Developer mode**.
2. **Load unpacked** → select this folder.
3. Click the toolbar icon to open the scrubber.
