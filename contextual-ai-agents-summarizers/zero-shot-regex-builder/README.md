# Zero-Shot Regex Builder v1.0.0

Compose regular expressions visually — no regex knowledge needed.
Pick pattern blocks (email, URL, date, phone, number range, digits,
word, literal, charset, …), arrange and reorder them, tune
quantifiers (once, *, +, ?, exactly n, n–m), and see the live regex
string. Test against your own sample text with match highlighting
and a match count. One click copies the finished regex. Number-range
blocks expand to exact alternations (capped at 500 values for
sanity). Everything runs on-device.

## Try it
1. Unzip `zero-shot-regex-builder.zip`.
2. `chrome://extensions` (or `edge://extensions`) → Developer mode →
   **Load unpacked** → select the folder. In Firefox: `about:debugging`
   → This Firefox → Load Temporary Add-on → select `manifest.json`.
3. Click the icon, add blocks, test, copy.

## Publishing notes
- Permissions: `storage` only (remembers your pattern and sample
  text). Nothing uploaded, no page access at all.
- Chrome Web Store: $5 one-time dev fee.
