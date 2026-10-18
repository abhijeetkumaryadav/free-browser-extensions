# EXIF Metadata Scrubber v1.0.0

Drop an image in (or pick a file) to **see its hidden metadata** — camera make/model, exposure, ISO, focal length, capture timestamp, and GPS coordinates — then produce a **scrubbed copy** with all of it removed.

**100% client-side:** the file is never uploaded anywhere. Parsing and re-encoding happen entirely inside the popup.

## How it works

- **JPEG:** scans APP1 segments, parses the TIFF/EXIF structure (IFD0, EXIF sub-IFD, GPS IFD) and SOF dimensions.
- **PNG:** reads IHDR dimensions plus tEXt / iTXt / zTXt chunks.
- **Scrubbing:** re-encodes the image on a canvas — JPEG at 92% quality, PNG rewritten — which drops all APP segments and ancillary chunks. Before/after byte sizes are shown.

## Install

**Chrome / Edge:** unzip → `chrome://extensions` (or `edge://extensions`) → enable **Developer mode** → **Load unpacked** → select the folder.

**Firefox:** `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → select `manifest.json`. (Temporary: reload after each browser restart.)

## Permissions

None. The extension uses no host, storage, or API permissions at all.

## Publishing notes

- MV3, no remote code, no network calls — straightforward for Chrome Web Store / Edge Add-ons review.
- Honest scope: EXIF scanning covers JPEG/PNG; scrubbing works for any decodable image (re-encoded as JPEG or PNG).
