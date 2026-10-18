# HighlightLayer — Persistent Web Highlighter

Highlight text on any page in 4 colors (yellow, lime, cyan, pink). Highlights are
saved per page and **automatically restored when you revisit**, using text-snippet
anchoring with surrounding context to find the right spot.

## Features

- **Highlight via context menu** — select text → right-click → HighlightLayer → color
- **Highlight via popup** — select text, open the popup, click a color swatch
- **Persistent** — highlights restore on revisit (best-effort on highly dynamic pages)
- **Manage** — per-page list with jump-to (scrolls to the highlight) and delete
- **Export** — download all highlights on a page as Markdown with source URL
- Non-destructive: deleting a highlight unwraps the span, restoring the original DOM

## Install

1. Unzip the package.
2. Open `chrome://extensions` (Edge: `edge://extensions`).
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the unzipped folder.
5. For Firefox: open `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → pick `manifest.json`. (Context menus work; long-term use needs signing.)

## Permissions

| Permission | Why |
|---|---|
| `storage` | Save highlights per page URL on your device |
| `contextMenus` | "Highlight" entries in the right-click menu |
| `activeTab` + `scripting` | Apply highlights on the page you are viewing, only when you act |
| `http://*/*`, `https://*/*` host access | Content script restores your saved highlights on pages you revisit |

No data leaves your device. No analytics, no network calls.

## Honest limits

- Restore is text-snippet based: on pages whose content changes heavily between visits (infinite feeds, A/B-tested copy), a highlight may not re-anchor — it's skipped silently.
- Cannot run on `chrome://`, `edge://`, `about:` or Web Store pages (browser restriction).
- Selections longer than 2000 characters are ignored to keep storage light.

## Publishing notes

- Manifest V3, no deprecated APIs.
- Single accent color (lime `#a3e635`), Lucide-style stroke icons.
- Privacy: everything is local; the store privacy disclosure is "no data collected".
