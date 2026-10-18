# Markdown Universal Clipper v1.0.0

Clip the current page (or your selected text) to clean, portable
Markdown: the page title as an `# H1`, a source line with the URL
and timestamp, your selection rendered as a blockquote, a page-text
excerpt, and images as `![alt](url)` references. Then **Copy** it or
**Download** it as a `.md` file — no account, no cloud.

## Try it
1. Unzip `markdown-universal-clipper.zip`.
2. `chrome://extensions` → Developer mode → **Load unpacked** → select the folder.
3. Open any page (select some text first if you only want that passage),
   click the extension icon → **Clip this page** → Copy or Download.

## Permissions
- `activeTab` + `scripting` — read the title, text, selection, and
  images of the page you are actively clipping. Nothing is touched
  until you click Clip.
- `clipboardWrite` — place the generated Markdown on your clipboard.
- All clipping happens on-device; nothing is uploaded anywhere.

## Publishing notes
- Minimal permissions, each justified in the listing description.
- Chrome Web Store: $5 one-time developer registration; MV3 build.
- Edge Add-ons: free account, same package works.
- Firefox (MV3): package works; submit the same zip via
  addons.mozilla.org for signing.
