# MashMoji — Custom Emoji Mashup Mixer

**Version 1.0.0** · Manifest V3 · Chrome / Edge / Firefox / Opera

Pick two emoji from a categorized palette and mash them into a single composite
tile. Preview the result live on a canvas card, copy it as a PNG, download it,
or save it to a local favorites vault.

## Features

- **Slot A / Slot B picker** — categorized palette (Faces, Gestures, Animals,
  Food, Travel, Objects, Nature, Symbols) with tabs and search.
- **Live composite preview** — emoji A + emoji B side-by-side on a gradient tile
  with an accent ring, rendered on a 256×256 canvas.
- **Copy as PNG** — copies the composite image to the clipboard (ClipboardItem API).
- **Download** — saves the composite as a PNG file via a blob URL (no `downloads`
  permission needed; the user clicks, the file downloads).
- **Favorites** — save mashes to a local favorites vault, click any favorite to
  reload it into the slots.
- All local, zero network.

## Install (Chrome / Edge / Opera)

1. Unzip `custom-emoji-mashup-mixer.zip`.
2. Open `chrome://extensions` (or `edge://extensions`).
3. Enable **Developer mode** (top-right).
4. Click **Load unpacked** and select the unzipped folder.

## Install (Firefox)

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…** and select `manifest.json`.
   (Temporary add-ons unload when Firefox restarts.)

## Permissions

- `storage` — persists your favorites vault locally. Nothing else is stored.

## Publishing notes

- MV3 only, no host permissions, no content scripts, no network calls.
- Copy-to-clipboard uses the standard async Clipboard API inside a user gesture.
- No external assets; icons are generated locally with PIL.
- Firefox note: `ClipboardItem` PNG support may vary by Firefox version;
  Download is the reliable fallback and is always available.
