# ChromaMark — Permanent Text Highlighter

Highlight text on any web page with one of 5 colors. Highlights persist per
page and are re-applied automatically when you revisit.

## Features

- 5 highlight colors (yellow, green, blue, pink, orange)
- Highlight via right-click context menu on any selection, or via the popup's
  "Highlight selection" button with your default color
- Highlights persist per page URL in local storage; restored on revisit
- Popup lists every highlight on the current page with jump-to and delete
- Clear-all option for the current page

## How it works

- `content.js` wraps selections in `<mark>` elements and stores records
  (`id`, exact text, color) under a per-URL storage key.
- On page load the script re-finds each exact text snippet in the page's text
  nodes and re-wraps it — no DOM positions stored, no page modification beyond
  the `<mark>` wrappers themselves.
- `background.js` only registers context menus; it holds no state.

## Honest limitations

- Restore matches exact text. On heavily dynamic pages (infinite scroll,
  live-updating feeds) a snippet may move or duplicate and the highlight can
  land in the wrong spot or not appear.
- Text inside iframes from other origins, shadow DOM, and canvas-rendered
  content cannot be highlighted.
- Does not run on `chrome://`, `edge://`, or browser store pages (platform
  restriction), so the context menu won't appear there.

## Install

**Chrome / Edge**
1. Download and unzip `color-coded-text-permanent-highlighter.zip`.
2. Open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

**Firefox**
1. Open `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on**.
2. Select `manifest.json`. (Temporary installs reset on browser restart; for
   permanent install the add-on must be signed via addons.mozilla.org.)
3. Note: Firefox uses `browser.*` in some contexts; this extension uses the
   `chrome.*` namespace which Firefox supports via its compatibility layer for
   these APIs.

## Permissions

| Permission | Why |
|---|---|
| `storage` | Save highlight records and your default color, on-device only |
| `contextMenus` | Add "ChromaMark → Highlight …" to the right-click menu on selections |

Host access (`http://*/*`, `https://*/*`) is needed to inject the highlighter
content script into web pages. The extension never sends data anywhere.

## Publishing notes

- Chrome Web Store: single-purpose (page highlighting), no remote code, no
  data collection — declare "no data collected" in the privacy section.
- Edge Add-ons: same package works as-is.
- Firefox: requires a signed build through AMO; `contextMenus` maps to
  `menus` automatically.
