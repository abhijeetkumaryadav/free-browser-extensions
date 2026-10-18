# Note Overlay Canvas v1.0.0

Sticky notes on any website. Hit **＋ Note** and a draggable,
resizable sticky note appears in a floating overlay layer — pick a
color, type, minimize, delete. Notes are saved **per site**
(`location.origin`) in on-device storage, so they’re waiting for you
when you come back. The overlay lives in an isolated Shadow DOM:
page styles can’t touch your notes, and your notes never modify the
page itself.

## Try it
1. Unzip `note-overlay-canvas.zip`.
2. `chrome://extensions` → Developer mode → **Load unpacked** → select the folder.
3. Open any website → click the extension icon → **＋ Note**.
   Drag by the header, resize from the corner, recolor with the dot,
   minimize with `–`.

## Permissions
- `storage` — persist your notes per site, on-device only.
- `activeTab` — the popup reads the current tab’s site so it can
  list that site’s notes and talk to the overlay.
- `content_scripts` on `http://*/*` and `https://*/*` — injects the
  overlay layer that renders your notes. It only ever renders notes
  and reads/writes your note data; it never reads page content,
  credentials, or keystrokes.
- All data stays on-device; nothing is uploaded.

## Publishing notes
- The `content_scripts` host permission is core functionality
  (notes must render on the sites you visit) — state this clearly in
  the store listing’s permission justification.
- Chrome Web Store: $5 one-time developer registration; MV3 build.
- Edge Add-ons: free account, same package works.
- Firefox (MV3): same zip submits to addons.mozilla.org for signing.
