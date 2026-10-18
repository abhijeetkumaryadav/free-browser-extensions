# Kaomoji Picker — Japanese Emoticons

**Version 1.0.0** · Manifest V3 · Chrome / Edge / Firefox / Opera

Searchable kaomoji (Japanese emoticon) picker with categories, click-to-copy,
and a recently-used tray. All local, zero network.

## Features

- **~110 built-in kaomoji** across 8 categories: Happy, Sad, Love, Angry,
  Surprised, Sleepy, Animals, Special.
- **Search + tabs** — filter by category or free-text search.
- **Click-to-copy** — copies to the clipboard with a visual flash + status note.
- **Recently used tray** — the last 16 copied kaomoji persist locally and are
  one click away at the top.
- All local, zero network.

## Install (Chrome / Edge / Opera)

1. Unzip `kaomoji-japanese-emoticon-picker.zip`.
2. Open `chrome://extensions` (or `edge://extensions`).
3. Enable **Developer mode** (top-right).
4. Click **Load unpacked** and select the unzipped folder.

## Install (Firefox)

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…** and select `manifest.json`.
   (Temporary add-ons unload when Firefox restarts.)

## Permissions

- `storage` — persists your recently-used tray locally. Nothing else is stored.

## Publishing notes

- MV3 only, no host permissions, no content scripts, no network calls.
- Copy uses the async Clipboard API with an `execCommand` fallback.
- No external assets; icons are generated locally with PIL.
