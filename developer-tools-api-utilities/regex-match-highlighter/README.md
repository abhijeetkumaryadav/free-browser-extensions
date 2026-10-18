# Regex Match Highlighter v1.0.0

Type any regex (with g / i / m / s flag chips) and highlight **every
match on the current page** in a violet overlay. The highlight layer
is non-destructive — text is only wrapped in spans, and **Clear**
unwraps everything back to the original page. See a live match
count, get friendly errors for invalid patterns, and jump-start with
quick patterns (email, URL, IPv4, date, hashtag, price).

## Try it
1. Unzip `regex-match-highlighter.zip`.
2. `chrome://extensions` → Developer mode → **Load unpacked** → select the folder.
3. Open any article or page → click the icon → try the **Email** quick pattern.

Firefox: `about:debugging` → This Firefox → Load Temporary Add-on → pick `manifest.json`.
Edge: `edge://extensions` → same Load unpacked flow.

## Permissions
- `activeTab` — highlight only on the tab you click the icon on. No page is touched otherwise.
- `scripting` — inject the highlighter into that tab (MV3, no remote code).
- `storage` — remembers your last pattern and flags on this device.

## Publishing notes
- Chrome Web Store: $5 one-time developer registration.
- Cannot run on `chrome://`, Web Store, or browser settings pages (browser-protected) — the popup says so instead of failing silently.
