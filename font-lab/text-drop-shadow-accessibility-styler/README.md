# TextShadow — Accessibility Text Drop Shadow

Adds a soft, adjustable drop shadow behind page text to improve readability,
especially helpful for low-vision users, bright pages, or thin fonts.
Fully reversible — nothing is modified permanently.

## Features
- Apply a text drop shadow to the active tab with one click
- Adjustable **offset** (0–6px), **blur** (0–14px), and shadow color
- Presets: dark shadow, light shadow, or a custom color + opacity
- Live preview in the popup
- **Restore page** button removes every trace; refreshing the page also clears it
- Badge shows whether a shadow is currently active on the tab

## Install (Chrome / Edge / Opera)
1. Download and unzip `text-drop-shadow-accessibility-styler.zip`.
2. Open `chrome://extensions`, enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

## Install (Firefox)
Firefox supports MV3 with the `scripting` permission for temporary installs:
`about:debugging` → This Firefox → Load Temporary Add-on → choose `manifest.json`.
(Packaging as a signed `.xpi` is needed for permanent installs.)

## Permissions (justified)
- `storage` — remembers your offset/blur/color settings on this device.
- `activeTab` — lets the popup interact with the tab you click it on.
- `scripting` — injects a small `<style>` element into the active tab on your click.

No network calls. No data collection. All settings stay on-device.

## Publishing notes
- MV3 only, no remote code, no deprecated APIs.
- The `activeTab` + `scripting` pair is the minimal way to restyle the current page on user gesture — reviewers accept this when the purpose is clear (it is: accessibility styling).
- Host permissions are not requested; the extension refuses restricted pages (chrome://, Web Store) with a clear message.
