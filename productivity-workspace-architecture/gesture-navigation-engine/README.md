# Gesture Navigation Engine v1.0.0

Navigate the web with right-mouse gestures. Hold the **right mouse button**
and draw on any page — a glowing trail follows your cursor and the gesture
runs on release:

| Gesture | Action |
|---|---|
| ← | Go back |
| → | Go forward |
| ↑ then ↓ | Reload page |
| ↓ then → | Close tab |
| ↑ | Scroll to top |
| ↓ | Scroll to bottom |

The popup shows the full gesture map with per-gesture enable/disable
switches, a master on/off toggle, and a trail on/off toggle. Plain
right-clicks (no movement) still open the normal context menu.

Gestures are strictly user-initiated: nothing is recorded, nothing is sent
anywhere.

## Try it
1. Unzip `gesture-navigation-engine.zip`.
2. `chrome://extensions` (or `edge://extensions`) → Developer mode → **Load unpacked** → select folder.
3. Hold right-click on any web page and draw ← to go back.

## Limitations
- Browsers block content scripts on `chrome://`, `edge://`, web-store, and
  `about:` pages — gestures only work on regular web pages.
- Firefox: install via `about:debugging#/runtime/this-firefox` → Load Temporary Add-on.

## Permissions
- `storage` — saves your gesture preferences on-device.
- Page access via `content_scripts` matches (http/https) — required to
  detect and draw gestures on web pages. No page content is read or sent.
- No `tabs` permission: closing a tab uses the message sender's own tab id.

## Publishing notes
- Chrome Web Store: $5 one-time dev fee. The `content_scripts` host access
  must be justified in the listing as the core feature.
- Edge Add-ons and Firefox Add-ons: free accounts; Firefox requires signing.
