# SpoilerBlur — Spoiler Keyword Filter

**Browse spoiler-free.** Add the words you never want to see (character names, "dies", "ending"…), and SpoilerBlur blurs matching text on every page. Click any blurred block to reveal it.

## What it does

- **Keyword blur list** — case-insensitive matching; add/remove keywords anytime
- **Click to reveal** — blurred blocks unveil individually; nothing is ever deleted
- **Master + per-site toggles** — one switch for everywhere, plus per-site overrides
- **Live counter** — popup shows how many blocks are blurred on the current page
- **Reveal all** — one click restores the page exactly
- **Dynamic pages** — a MutationObserver keeps up with SPAs and infinite scroll

## Honest scope

- Matches plain text on the page; it can't read spoilers inside images or videos
- Works on `http(s)` pages only — not on `chrome://`, the Web Store, or other extensions' pages
- Very long pages with thousands of matches may take a moment on first scan

## Permissions

| Permission | Why |
|---|---|
| `storage` | Saves your keywords, master toggle, and per-site overrides on-device. |
| *(content script on http/https)* | Runs the blur logic in pages. No data is read, stored, or sent anywhere — matching happens entirely in the page. |

No `tabs` permission needed: the popup talks to the page's content script via messaging.

## Install

1. Download/unzip this folder
2. Open `chrome://extensions` (Edge: `edge://extensions`; Firefox: `about:addons` → gear → "Install Add-on From File")
3. Enable **Developer mode** (Chrome/Edge)
4. **Load unpacked** → select this folder

## Publishing notes

- Manifest V3, minimal permissions (`storage` + page-local content script)
- No remote code, no analytics, no network calls: privacy disclosure is minimal
- Firefox: content scripts + storage are fully compatible

## File layout

- `manifest.json` — MV3 manifest
- `popup.html` / `popup.css` / `popup.js` — settings UI
- `content.js` / `content.css` — page-side blur engine
- `icons/` — generated PNG icons (16/48/128)
