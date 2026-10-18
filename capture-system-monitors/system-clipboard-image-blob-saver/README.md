# ClipSave — Clipboard Image Saver (v1.0.0)

Read an image from your clipboard with one press, preview it, and save it as a PNG — 100% on your device, zero network.

## Features

- **Read image from clipboard** button (explicit user gesture only — nothing is ever read automatically or in the background).
- Instant preview with dimensions, source format, and file size.
- **Save as PNG**: the image is re-encoded locally via canvas, then saved through your browser's normal download flow (you get the standard download prompt — nothing is downloaded silently).
- Editable filename (sanitized automatically), one-click copy-back-to-clipboard.

## Honest scope

- Reads the clipboard **only** when you press the button. Extensions cannot read the clipboard silently in the background, and this one doesn't try.
- The image never leaves your device: no uploads, no servers, no network calls.
- Saving uses a local blob URL + anchor download; no `downloads` permission, no silent downloads.

## Permissions — why each one

| Permission | Why |
|---|---|
| `clipboardRead` | Lets the popup read an **image** from the clipboard when you press the Read button. |

That's the only permission. No storage, no host permissions, no content scripts, no remote code.

## Install (Chrome / Edge / Opera)

1. Unzip `system-clipboard-image-blob-saver.zip`.
2. Go to `chrome://extensions` (or `edge://extensions`, `opera://extensions`).
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the unzipped folder.

## Install (Firefox)

`about:debugging` → "This Firefox" → "Load Temporary Add-on". `clipboardRead` maps to Firefox's clipboard permission; the read button is Chrome/Edge-tested.

## Publishing notes

- Zero network usage; honest single-purpose description.
- Note for reviewers: clipboard access is strictly user-gesture-gated with an in-popup label.
