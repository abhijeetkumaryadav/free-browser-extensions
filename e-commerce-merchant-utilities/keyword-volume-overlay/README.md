# Keyword Volume Overlay v1.0.0

**Analyze** any page: extracts visible text, ranks the top 20 keywords
by frequency (stopwords and boilerplate filtered), and attaches a
heuristic monthly search-volume *estimate* to each. Click any keyword
to copy it. Recent analyses are kept in history.

Volumes are on-device heuristic estimates for prioritization — this
extension uses no paid keyword API and makes no network calls.

## Try it
1. Unzip `keyword-volume-overlay.zip`.
2. `chrome://extensions` → Developer mode → **Load unpacked** → select folder.
3. Open any content page → click the icon → **Analyze**.

**Firefox**: `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → `manifest.json`.

## Publishing notes
- Permissions: `activeTab` + `scripting` (read the page you analyze),
  `storage` (history on-device). Nothing uploaded.
- Chrome Web Store: $5 one-time dev fee.

## Files
```
manifest.json, popup.html/css/js, icons/, README.md
```

## Future-proofing
- Manifest V3 only. Page parsing isolated in one injectable, dependency-free function.
- Volume heuristic is a single named function (`estimateVolume`), easy to swap for a real API later.
