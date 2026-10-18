# TOCsmith — Table of Contents Builder

Build a nested table of contents from any page's headings (h1–h6) or from pasted Markdown. Click an entry to smooth-scroll to it; export the TOC as a Markdown or HTML list.

## Features

- **Scan this page** — read-only heading extraction via on-demand injection (assigns anchor ids only for scroll targets; page content is never modified)
- **Markdown mode** — paste Markdown, `#` headings are parsed (fenced code blocks ignored)
- **Click-to-scroll** entries with normalized indentation
- **Copy as Markdown / HTML** with proper nested lists
- Remembers the last scan per tab (session convenience, on-device)

## Install

1. Download/unzip, then open `chrome://extensions` (Edge: `edge://extensions`; Firefox: `about:debugging#/runtime/this-firefox`)
2. Enable **Developer mode** → **Load unpacked** → select this folder

## Permissions

- `activeTab` + `scripting` — inject the read-only heading scanner into the tab you click on, and scroll to headings. Nothing runs until you click.
- `storage` — remembers the last scan per tab. On-device only.

## Publishing notes

- Manifest V3, no remote code, no data collection — straightforward for Chrome Web Store / Edge Add-ons review.
- Firefox: MV3 supported in Firefox 109+; `chrome.scripting.executeScript` with `func` is supported.
- Note: cannot scan `chrome://`, `edge://`, or Web Store pages (browser restriction).
