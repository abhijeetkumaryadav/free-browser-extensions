# Font Geometry Inspector v1.0.0

Click **Pick element on page**, then click any element on the site
you're viewing. A violet highlight follows your cursor (Esc cancels);
on click, the popup reports the element's full font geometry:
font-family stack, size, weight (with friendly name), style,
line-height, letter-spacing, word-spacing, text-transform, alignment,
decoration, and color (with swatch + hex). **Copy all as CSS** with
one click.

## Try it
1. Unzip `font-geometry-inspector.zip`.
2. `chrome://extensions` → Developer mode → **Load unpacked** → select the folder.
3. Click the icon → **Pick element on page** → click any element →
   reopen the extension to see the results.

## Permissions
- `activeTab` + `scripting` — inject the one-click element picker
  into the tab you're viewing, only when you press the button.
- `storage` — holds the last inspection so it survives the popup
  closing while you pick. All on-device, nothing uploaded.

## Publishing notes
- Chrome Web Store: $5 one-time developer registration fee.
- No persistent content scripts, no background page, no network calls.
