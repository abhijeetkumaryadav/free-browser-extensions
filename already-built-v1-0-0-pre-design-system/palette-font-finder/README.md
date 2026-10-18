# Palette + Font Finder v1.0.0

Click the toolbar icon, hit **Analyze this page**, and get the site's
real color palette (ranked by usage) plus its font stack with live
previews. Click any swatch or font to copy it. Export the palette as
CSS variables, or save palettes for later.

## Try it

**Chrome / Edge / Brave / Opera**
1. Unzip `palette-font-finder.zip`.
2. `chrome://extensions` → Developer mode → **Load unpacked** → select folder.
3. Open any website, click the extension icon → **Analyze this page**.

**Firefox**: `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → `manifest.json`.

## Notes for publishing

- Permissions: `activeTab` (read the current tab's styles only when you
  click Analyze), `scripting` (run the analyzer in the page),
  `storage` (saved palettes stay on your device). No data leaves the machine.
- Chrome Web Store: $5 one-time dev fee. Everything else is free.

## Files

```
manifest.json   MV3 config
popup.html/css/js   UI + analyzer (analyzePage is injected into the tab)
icons/          16 / 48 / 128 px
```
