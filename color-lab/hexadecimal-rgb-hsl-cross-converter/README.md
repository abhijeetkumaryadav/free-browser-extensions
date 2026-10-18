# ChromaShift — Color Format Converter v1.0.0

Convert colors live between HEX, RGB, HSL and HSV. Type in any format and every other field syncs instantly. Big color preview (click to open the system color picker), per-format copy buttons, and a persistent recent-colors tray.

## Install (developer mode)

**Chrome / Edge:**
1. Unzip `hexadecimal-rgb-hsl-cross-converter.zip`.
2. Go to `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

**Firefox:** load via `about:debugging` → This Firefox → Load Temporary Add-on (select `manifest.json`). The native `<input type="color">` picker is supported.

## Permissions

- `storage` — saves recent colors locally on the device. Nothing leaves the browser.

## Notes

- Supports 6-digit and 3-digit HEX (`#8B5CF6`, `#f0a`, with or without `#`).
- Invalid HEX input shows an inline error without clearing your work.
- Recent colors are recorded with a short debounce so typing doesn't flood history.
- 100% local — no network calls, no remote code.

## Publishing notes

- Single purpose, minimal permissions, no remote code — store-friendly.
- Provide a 1280×800 promo screenshot showing all four formats synced.
