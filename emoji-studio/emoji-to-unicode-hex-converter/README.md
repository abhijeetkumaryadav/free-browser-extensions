# GlyphHex — Emoji Unicode Converter

Developer tool that converts emoji (and any text) to exact Unicode codepoints
and back. Handles surrogate pairs, ZWJ sequences, skin-tone modifiers and
regional-indicator flags correctly via `Intl.Segmenter`. 100% local — no network.

## Features

**Emoji → Code**
- Paste any emoji or text; each grapheme cluster is listed with its codepoints as
  `U+XXXX` chips (click a chip to copy it).
- Copy the whole thing as a `U+` list (`U+1F600 U+1F44D`) or as `\u{…}` escapes
  (`\u{1F600}\u{1F44D}`), ready to paste into source code.

**Code → Emoji**
- Paste codepoints in any common form, space/comma/newline separated:
  `U+1F600`, `1F600`, `0x1F600`, `\u{1F600}`, even surrogate pairs like
  `\uD83D\uDE00` — and get the emoji back.
- Invalid tokens are reported and skipped.

## Install (developer mode)

**Chrome / Edge / Opera**
1. Download and unzip `emoji-to-unicode-hex-converter.zip`.
2. Open `chrome://extensions` (or `edge://extensions`).
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the unzipped folder.

**Firefox**
1. Open `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on**.
2. Select `manifest.json` in the unzipped folder. (Temporary install; removed on restart.)

## Permissions

- `storage` — remembers your last typed input between sessions.

Nothing else. No host permissions, no network access.

## Notes for store publishing

- Suggested summary: *"Convert emoji to exact Unicode codepoints (U+1F600) and back — ZWJ, skin tones and flags handled correctly."*
- Icons included: 16 / 48 / 128 px.
- MV3 only, no remote code.
