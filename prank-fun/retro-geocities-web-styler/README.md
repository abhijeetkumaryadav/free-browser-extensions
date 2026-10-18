# Geocities Rewind — 1999 Page Styler

A harmless joke extension: one click restyles the current page like a 1999
Geocities site — tiled starry background (pure CSS), Times New Roman
everywhere, rainbow dividers, an "under construction" banner, blinking
headings, and a random visitor counter. A second click restores the page.

## Install (development build)

1. Unzip this package anywhere on your machine.
2. Open `chrome://extensions` (Chrome/Edge), `edge://extensions`, or
   `brave://extensions`.
3. Enable **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the unzipped folder.
5. Pin the extension, then click it on any page and hit **Geo-fy this page**.

Firefox: `about:debugging#/runtime/this-firefox` → Load Temporary Add-on →
select `manifest.json`.

## Permissions

- `activeTab` — lets the popup see which tab you are on when you click a
  button.
- `scripting` — injects the style/DOM changes into that tab, only in
  response to your click. No host permissions are requested; injection is
  impossible without you clicking.

No network calls. Nothing is collected, stored, or transmitted.

## Publishing notes

- Store-safe: reversible DOM styling, no persistent page modification,
  user-triggered only, clearly labeled as a joke.
- Manifest V3, no deprecated APIs, no remote code.
