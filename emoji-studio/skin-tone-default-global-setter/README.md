# ToneSet — Emoji Skin Tone Picker

Pick a default skin tone; the extension's bundled emoji picker shows and copies
emoji with that modifier applied.

## Scope (honest)
- This extension only affects **emoji you copy from its own popup picker**.
- It does **not** change emoji system-wide, in other apps, or on web pages.
- Browsers and OSes do not expose a global default skin-tone setting to extensions.

## Install
1. Unzip the package.
2. Open `chrome://extensions` (Chrome/Edge) or `about:addons` (Firefox).
3. Enable **Developer mode** → **Load unpacked** → select the folder.

## Permissions
- `storage` — remembers your chosen skin tone between sessions.

## Publishing notes
- Manifest V3, zero network calls, no remote code.
- Chrome Web Store: single-purpose utility. Firefox: compatible as-is.
