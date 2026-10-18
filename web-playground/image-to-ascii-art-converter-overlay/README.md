# AsciiArt — Image to ASCII Converter

Drop any image and turn it into ASCII art: brightness-mapped characters with
adjustable width, contrast, brightness, three character sets, and an invert
option. Copy as text or download as `.txt`.

## Install (development build)

1. Unzip `image-to-ascii-art-converter-overlay.zip` (or use the source folder).
2. Open `chrome://extensions` (Edge: `edge://extensions`).
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the extracted folder.

## How to use

1. Click the AsciiArt toolbar icon.
2. Drop an image onto the dropzone (or click to choose a file).
3. Adjust **width** (characters), **contrast**, **brightness**, **charset**, and
   **invert** — the preview updates live.
4. **Copy text** to put the art on your clipboard, or use the download icon to
   save a `.txt` file.
5. **New image** starts over.

Tips:
- Smaller widths (40–80) read better in chat apps and comments.
- The `blocks` charset looks great in terminals.

## Permissions

- `storage` — remembers your slider/charset settings on this device. That's it.

## Technical notes

- Uses `FileReader` + an offscreen canvas: the image is drawn small, then each
  pixel's Rec. 709 luma (adjusted for brightness/contrast) is mapped to a
  character from darkest to lightest.
- Monospace glyphs are roughly twice as tall as wide, so row count is halved
  to keep the aspect ratio natural.
- Trailing spaces are trimmed per row to keep copied text clean.
- Copy uses `navigator.clipboard` with a select-and-copy fallback.
- No network calls. Images never leave your device.

## Publishing notes

- MV3 only, no remote code, no deprecated APIs.
- No host permissions; works entirely inside the popup.
