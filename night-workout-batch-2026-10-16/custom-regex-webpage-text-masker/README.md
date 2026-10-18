# Custom Regex Webpage Text Masker

Define your own regex patterns (e.g. emails, phone numbers, card numbers,
salary figures) and mask matching text on the current page — either **blurred**
in place or **replaced** with a placeholder of your choice. Handy for demos,
screenshots, and screen-shares.

## Honest scope

- **Visual masking only.** The page source, form values, and clipboard are
  untouched — this hides text from view, not from the DOM. Don't rely on it for
  real security (e.g. sharing a page still shares the data).
- Patterns live only in this browser's `chrome.storage.local`; nothing leaves
  the device.
- Invalid regexes are rejected in the popup; the content script also skips bad
  patterns defensively.
- Skips `<script>`, `<style>`, inputs, textareas, and editable regions.
- Per-site memory: "Remember masking for this site" re-applies automatically
  when you open the popup on that host.

## Files

- `manifest.json` — MV3, `storage` + `activeTab` + `scripting`
- `popup.html` / `popup.css` / `popup.js` — pattern manager UI
- `content.js` — on-demand masking engine (guarded against double injection)
