# CiteClip — Citation Clipper v1.0.0

Clip selected text with its source. Right-click any selected text → **“Clip with citation”** and the quote is saved together with the page title, URL and access date. The popup library lets you search clips, copy them as Markdown / APA-ish / plain citations, delete them, and export everything as JSON.

All data stays on-device in `chrome.storage.local`. No network calls, no accounts, no analytics.

## Install

**Chrome / Edge**
1. Unzip `context-url-citation-clipper.zip`.
2. Go to `chrome://extensions` (or `edge://extensions`).
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the unzipped folder.

**Firefox** (source install)
1. Unzip the package.
2. Go to `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → pick `manifest.json`.
   - Note: `chrome.contextMenus` maps to `browser.menus` in Firefox; the `chrome.*` namespace with callbacks is supported via the WebExtensions polyfill pattern used here, but a production Firefox listing would swap to `browser.*` promises.

## Permissions (minimal, justified)

| Permission | Why |
|---|---|
| `storage` | Save the clip library and the remembered citation format on-device. |
| `contextMenus` | Add the “Clip with citation” right-click entry on selected text. |
| `activeTab` | Temporary access to the tab where the menu was opened, so the clip can record that tab's title and URL. No broad host access. |

## Citation formats

- **Markdown** — blockquote with source link and access date, ready to paste into notes.
- **APA-ish** — `"Quote" (Title, Month Day, Year). Retrieved from URL` (adapted; no author is available from a selection).
- **Plain** — quote, title, URL and access date as plain text.

## Notes & limits

- Clips are capped at the 500 most recent to bound storage.
- Quotes are truncated to 2000 characters.
- Export downloads a `citeclip-export-YYYY-MM-DD.json` file via a blob URL — no `downloads` permission needed.
- Not tested in a live browser beyond packaging; validation covered manifest parsing, JS syntax, icon generation and ZIP structure.

## Publishing notes

- MV3 only, no deprecated APIs.
- No remote code, no external requests — should pass Chrome Web Store and Edge Add-ons review without a privacy-policy complication beyond the standard “stores data locally” disclosure.
- Listing assets needed: 128px icon (included), screenshots, short + full description.
