# Contextual Tab Grouper v1.0.0

One click on **Scan tabs** and your current window's tabs are
analyzed by site and topic (Development, Social, News, Shopping…).
Rename any suggestion, pick its color, remove tabs you don't want —
then **Create groups** builds real browser tab groups with those
names and colors. **Ungroup all** reverses everything in the window.

## Try it
1. Unzip `contextual-tab-grouper.zip`.
2. `chrome://extensions` → Developer mode → **Load unpacked** → select the folder.
3. Open several tabs, click the extension icon → **Scan tabs** → **Create groups**.

## Publishing notes
- Permissions: `tabs` (read this window's tabs to suggest groups),
  `tabGroups` (create / name / color / ungroup), `storage` (one
  preference). Everything stays on-device.
- Chrome Web Store: $5 one-time dev fee. `tabGroups` works in
  Chrome/Edge; Firefox handles groups differently, so this build
  targets Chromium browsers.
