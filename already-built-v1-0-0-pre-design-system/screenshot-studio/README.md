# Screenshot Studio v1.0.0

Capture the visible tab, then edit: **crop** (drag a rectangle),
**blur** (paint over sensitive bits), **text** captions, **undo** —
then export at the original size or pre-sized for Instagram
(Post 1080×1350, Story 1080×1920, Square 1080×1080).

## Try it

**Chrome / Edge / Brave / Opera**
1. Unzip `screenshot-studio.zip`.
2. `chrome://extensions` → Developer mode → **Load unpacked** → select folder.
3. Click the icon → **Capture visible area** → the editor opens in a new tab.

**Firefox**: `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → `manifest.json`.

## Notes for publishing

- Permissions: `activeTab` (capture the tab you clicked on),
  `storage` (holds the screenshot while the editor opens — cleared after).
  Nothing is uploaded anywhere.
- Chrome Web Store: $5 one-time dev fee. Everything else is free.

## Files

```
manifest.json       MV3 config
popup.html/js       capture button
editor.html/js      canvas editor (crop / blur / text / undo / export)
icons/              16 / 48 / 128 px
```
