# Markdown Toolbar — Inline Text Styler

## Honest scope
Adds a small floating **markdown formatting toolbar** above the active text field on any page.
Real WYSIWYG editing inside arbitrary inputs isn't possible — this extension **inserts markdown
syntax** (bold, italic, code, link, list, heading) around your selection. The page shows the raw
markdown text; nothing is rendered as rich text.

## How it works
1. Click the extension icon → **Attach toolbar to active field**.
2. Click any textarea, text input, or editable area on the page.
3. The toolbar appears just above it — click **B**, **I**, **</>**, **🔗**, **•**, **H** to wrap
   your selection in markdown.
4. **Remove toolbar** (or the ✕ on the bar) deletes every trace. Page content is never modified.

## Permissions
- `storage` — remembers nothing sensitive (toolbar prefs only).
- `activeTab` + `scripting` — injects the toolbar only when you click Attach.

## Privacy
100% local, zero network calls. No text is stored or transmitted.
