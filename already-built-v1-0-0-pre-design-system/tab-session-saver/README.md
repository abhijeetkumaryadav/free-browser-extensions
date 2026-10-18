# Tab Session Saver v1.0.0

One click saves every open tab in the current window as a named
session. Restore a session into a fresh window (pinned tabs stay
pinned), open its tabs in the current window, delete, export, or
import sessions as JSON.

## Try it

**Chrome / Edge / Brave / Opera**
1. Unzip `tab-session-saver.zip`.
2. `chrome://extensions` → Developer mode → **Load unpacked** → select folder.
3. Open some tabs, click the icon, name the session, hit Save.

**Firefox**: `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → `manifest.json`.

## Notes for publishing

- Permissions: `tabs` (read your open tabs to save them),
  `storage` (sessions live on your device). Nothing is uploaded.
- Chrome Web Store: $5 one-time dev fee. Everything else is free.

## Files

```
manifest.json       MV3 config
popup.html/css/js   save / restore / import / export UI
icons/              16 / 48 / 128 px
```
