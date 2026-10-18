# EmojiPack — Slack & Discord Custom Emoji Packer

Prepare custom emoji packs for Slack or Discord. Everything happens on your device: pick images, rename them to safe shortcode names, preview at 128×128, validate sizes — then download a ZIP with `name.png` files plus an upload guide.

## Honest scope

- **Manual upload only.** EmojiPack does NOT upload to Slack or Discord (that requires OAuth and workspace admin APIs). You upload the prepared PNGs in Slack/Discord settings yourself; step-by-step instructions are in the popup and in the ZIP's `UPLOAD_GUIDE.txt`.
- **Zero network.** No accounts, no analytics, no API keys.
- Animated GIFs are re-encoded as static PNG previews (animation is not preserved).

## Features

- Platform switch: Slack (128 KB limit) / Discord (256 KB limit) with per-platform rule cards
- Drag & drop or browse, up to 50 images (PNG/JPG/GIF/WEBP)
- Live shortcode sanitizing per platform rules, collision-safe names
- 128×128 cover-fit resize preview, per-file size badges (READY / LARGE / ISSUE)
- One-click ZIP export with `UPLOAD_GUIDE.txt` (JSZip bundled locally at build time)
- Platform preference remembered

## Install

1. Unzip the package (or use the folder directly).
2. Open `chrome://extensions` (Edge: `edge://extensions`), enable **Developer mode**.
3. **Load unpacked** → select the extension folder.
4. Pin EmojiPack to the toolbar.

Firefox: `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → `manifest.json`.

## Permissions

- `storage` — remembers your Slack/Discord platform choice. Nothing else.

## Publishing notes

- Manifest V3, no remote code (JSZip 3.10.1 is bundled in `lib/`).
- No host permissions, no content scripts — popup-only tool.

## Files

- `manifest.json` — MV3 manifest
- `popup.html` / `popup.css` / `popup.js` — the packer UI
- `lib/jszip.min.js` — JSZip 3.10.1, bundled locally (MIT license, © Stuart Knightley)
- `icons/` — 16/48/128 PNG icons
