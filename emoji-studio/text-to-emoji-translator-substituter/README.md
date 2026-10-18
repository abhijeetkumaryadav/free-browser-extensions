# WordMoji — Text to Emoji Translator v1.0.0

Turn words into emoji. Paste text, matched words are swapped for emoji from a
built-in local dictionary (~400 words), density controls how many eligible words
get swapped, and every swapped word is clickable to toggle it back word ⇄ emoji.
Undo stack, copy-to-clipboard, draft autosave.

All local — zero network, nothing leaves your device. No AI, no API calls:
matches come from the bundled dictionary only.

## Install

1. Unzip the package (or `Load unpacked` on the folder).
2. Open `chrome://extensions` (Chrome/Edge) or `about:debugging#/runtime/this-firefox` (Firefox).
3. Enable **Developer mode**.
4. **Load unpacked** → select the `text-to-emoji-translator-substituter` folder.
5. Pin WordMoji and click the toolbar icon.

## Usage

1. Type or paste text into the box.
2. Adjust **Density** (what % of eligible words get swapped).
3. Click **Translate**.
4. Click any highlighted word to flip it back to text (or to emoji).
5. **Undo** steps back through every change; **Copy result** copies the final text.

Keyboard: `Enter` (no Shift) translates.

## Permissions

- `storage` — saves your draft text and density setting locally. No other
  permission is requested.

## Publishing notes

- Manifest V3, no content scripts, no host permissions, no remote code.
- Icons are generated PNGs (16/48/128).
- Safe for Chrome Web Store / Edge Add-ons / Firefox Add-ons submission.
