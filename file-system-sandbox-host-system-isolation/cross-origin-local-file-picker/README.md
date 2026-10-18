# FileScope — Local File Inspector

Inspect local files entirely on-device: pick files via the file picker (or
drag & drop) and see metadata (name, size, type, last modified), a SHA-256
hash, a text preview for text files, and an image preview for images.

## Honest scope

- Files are **chosen by you** via the picker — the extension cannot see any
  file you don't explicitly hand it, and it cannot reach across origins.
- **Nothing is uploaded anywhere.** Hashing uses `crypto.subtle` locally;
  previews use in-memory object URLs. There are zero network calls.
- History stores **metadata + hashes only**, never file contents.

## Features

- Multi-file picker + drag & drop
- SHA-256 hash per file with copy button
- Text preview (first 8 KB) for text-like files, image preview for images
- Metadata: size, MIME type, last-modified date
- On-device history of inspected files (metadata only), clearable

## Install

1. Unzip the release ZIP.
2. Open `chrome://extensions` (Edge: `edge://extensions`).
3. Enable **Developer mode**.
4. **Load unpacked** → select the unzipped folder.
5. Click the toolbar icon, drop in files, inspect.

Firefox: `about:debugging` → This Firefox → Load Temporary Add-on.

## Permissions

- `storage` — saves the metadata-only inspection history on-device.
  Justified: it's the only persistence the feature needs.

## Publishing notes

- Chrome Web Store / Edge Add-ons: single purpose is "local file inspection";
  no data collection, no remote code → straightforward privacy disclosure.
- Firefox Add-ons: MV3 supported; `crypto.subtle` is available in extension
  pages.
