# TabForge — New Tab Theme Studio

Design your own new-tab page: accent color, background gradients or your own
image, dark/light mode, quick-link tile styles, and saved theme presets — all
applied to the extension's own local new-tab page.

## Honest scope

Browser extensions **cannot restyle the browser chrome** (toolbar, tabs,
address bar). TabForge themes only the extension's local `newtab.html` page.
This is stated in the popup header so users are never misled.

## Features

- Accent color swatches + custom picker
- Gradient backgrounds (presets + custom) or your own uploaded image (≤ 2 MB)
- Dark / light mode, rounded / square / pill tile styles
- Clock, date, greeting, optional web search box (Google, user-initiated)
- Quick-link tiles: add / remove, persisted on-device
- Built-in presets + save your own named presets
- Live preview in the popup; changes apply instantly to new tabs

## Install

1. Unzip the release ZIP.
2. Open `chrome://extensions` (Edge: `edge://extensions`).
3. Enable **Developer mode**.
4. **Load unpacked** → select the unzipped folder.
5. Open a new tab to see your themed page; click the toolbar icon to open the studio.

Firefox: `about:debugging` → This Firefox → Load Temporary Add-on (new-tab
override works; theme persists per profile).

## Permissions

- `storage` — saves your theme, presets, and quick-link tiles on-device.
  Nothing leaves the device; no network calls are made by the extension
  itself (the optional search box navigates you to Google only when you
  submit it).

## Publishing notes

- Chrome Web Store: single purpose is "new tab page customization"; `storage`
  is minimal and justified. No remote code, no data collection → simple
  privacy disclosure.
- Edge Add-ons: same package works.
- Firefox Add-ons: MV3 supported; new-tab override allowed.
