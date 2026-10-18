# Rickroll Roulette — Link Prank

A harmless joke extension: pick a number (default 1), hit **Spin the roulette**,
and that many random links on the current page quietly get their `href`
swapped to a famous public music video. Link text and styling are untouched —
the links look completely normal until clicked. **Restore links** puts the
original URLs back.

Nothing else is changed on the page. No network calls, no redirects, no
autoplay tricks, no data collection.

## Install (development build)

1. Unzip this package anywhere on your machine.
2. Open `chrome://extensions` (Chrome/Edge), `edge://extensions`, or
   `brave://extensions`.
3. Enable **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the unzipped folder.
5. Click the extension on any page and spin the roulette.

Firefox: `about:debugging#/runtime/this-firefox` → Load Temporary Add-on →
select `manifest.json`.

## Permissions

- `activeTab` — lets the popup see which tab you are on when you click a
  button.
- `scripting` — runs the link-swap/restore functions in that tab, only in
  response to your click. No host permissions are requested.

The destination is a single hard-coded public video URL. No network calls.
Nothing is collected, stored, or transmitted.

## Publishing notes

- Store-safe: reversible, user-triggered, clearly labeled as a joke, scoped
  to the current page only, with an explicit restore path.
- Manifest V3, no deprecated APIs, no remote code.
