# SVG Code Optimizer Grabber v1.0.0

Find every inline SVG on the current page. Each is listed with a
live preview and its dimensions — click one to see a basic
optimizer applied (comment stripping, whitespace collapsing,
path-decimal rounding, default-attribute removal) with before/after
byte sizes, then copy the code or download it as a `.svg` file.

## Try it
1. Unzip `svg-code-optimizer-grabber.zip`.
2. Chrome/Edge: `chrome://extensions` → Developer mode → **Load unpacked** → select the folder.
   Firefox: `about:debugging` → This Firefox → **Load Temporary Add-on** → select `manifest.json`.
3. Open any page with icons → click the extension → **Scan**.

## Permissions
- `activeTab` + `scripting`: read the current tab's SVG markup when you click Scan. Nothing else touched, nothing uploaded.

## Publishing notes
- Chrome Web Store: $5 one-time developer registration. Minimal, justified permissions.
