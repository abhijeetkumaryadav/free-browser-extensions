# Website Localization Previewer v1.0.0

Pseudolocalization preview for developers: enter UI strings (or grab
visible text from the current page) and transform them with accented
characters, ~40% length expansion, and `[!!! … !!!]` bracket markers —
so you can spot layout breakage *before* real translation. Copy-all and
per-string copy included.

**Important:** this produces FAKE TEXT for layout testing only. It is
not machine translation and must never ship in a real product.

## Try it
1. Unzip `website-localization-previewer.zip`.
2. `chrome://extensions` → Developer mode → **Load unpacked** → select folder.
3. Open any page, click the icon, hit **Grab from page**, then **Transform**.

## Permissions (justified)
- `activeTab` + `scripting` — read visible text on the page you click the
  button on, only when you ask. Never runs automatically.
- `storage` — remember your strings and options on-device. Nothing uploaded.

## Publishing notes
- Chrome Web Store: $5 one-time dev fee. Firefox: free, requires signing.
- All data stays on-device; no network calls.
