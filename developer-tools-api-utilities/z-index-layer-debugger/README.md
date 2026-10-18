# Z-Index Layer Debugger v1.0.0

Click **Scan page** on any site to list every positioned element with
an explicit z-index, sorted highest-first with a readable selector
and its position type. **Show overlay** draws a floating,
color-coded highlight over each layered element (with a z: label) —
fully non-destructive: it never touches your page's DOM, and
toggling it off removes everything.

## Try it
1. Unzip `z-index-layer-debugger.zip`.
2. `chrome://extensions` → Developer mode → **Load unpacked** → select folder.
3. Open any site → click the icon → **Scan page** → **Show overlay**.

## Permissions
- `activeTab` — scan the page you're looking at, only when you click.
- `scripting` — run the scan/highlight code in that tab.
- Nothing is stored or sent anywhere.

## Publishing notes
- Chrome Web Store: $5 one-time dev fee; Firefox: free, needs signing.
- Two minimal, user-initiated permissions — store-friendly.
