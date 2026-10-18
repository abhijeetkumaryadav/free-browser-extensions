# HashCheck — File Hash & Checksum Verifier v1.0.0

Compute **SHA-256**, **SHA-512**, **SHA-1** and **MD5** checksums of any file and compare them against an expected hash. 100% local — the file never leaves your device.

## Features
- Drag & drop or click to choose a file
- SHA-256 / SHA-512 / SHA-1 via the WebCrypto API, MD5 via a bundled local implementation
- Progress bar for large files (chunked reading)
- Per-algorithm toggle; click-to-copy digests
- Paste an expected hash → instant **Match / No match** verdict

## Honest scope
- **MD5 is included only for legacy checksum comparison** (e.g. verifying old downloads). MD5 is cryptographically broken — never use it for security.
- Everything runs on-device. No network, no analytics, no storage of file contents.

## Permissions
- **None.** The extension needs no permissions at all (WebCrypto and file input work in the popup context).

## Install (Chrome / Edge / Opera)
1. Unzip `sha256-md5-file-hash-checksum-verifier.zip`
2. Open `chrome://extensions`, enable **Developer mode**
3. **Load unpacked** → select the unzipped folder

Firefox: `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → pick `manifest.json`.

## Publishing notes
- Manifest V3, zero permissions, zero network calls — minimal review friction.
- Icons generated with PIL (gradient rounded square + hash glyph).
