# MetaStrip — EXIF Metadata Remover

Remove metadata (EXIF, XMP, ICC profiles) from images before you share them.
Fully local — nothing is uploaded.

## What it does

- Load any local image (drag & drop or click to choose).
- **Metadata scan** — walks the raw JPEG bytes and reports whether the
  original contains EXIF, XMP, or ICC profile segments (before stripping).
- **Re-encode via canvas** — canvas export drops all APP segments, so the
  output is a clean pixel image with no metadata.
- **Output quality slider** (0.50–1.00) — default 0.92.
- **Before/after byte sizes** and a **Download stripped copy** button.

## Honest limits

- **Images only — not documents.** PDF/Office metadata is untouched.
- Stripping **re-encodes the image** (JPEG); minor quality loss is expected.
  Keep originals.
- Only the first frame of animated images is processed.
- GPS coordinates, camera model, timestamps and similar fields are removed
  because the entire metadata segment is discarded — not selectively edited.

## Privacy

Everything runs on your device (FileReader + canvas). The only permission
is `storage` (reserved for future settings). No network calls, ever.

## Validation

- `manifest.json` parses, Manifest V3.
- `node --check` passes on all JS.
- Headless engine tests: 13/13 pass (JPEG metadata detection incl. EXIF,
  XMP, ICC, non-JPEG rejection, SOS stop, quality clamping, summary labels).
