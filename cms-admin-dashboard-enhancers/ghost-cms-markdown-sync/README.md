# Ghost Markdown Composer

Write blog posts in Markdown with a live preview, then copy Ghost-ready
Markdown + frontmatter (or download a `.md` file) for pasting into Ghost.

## Features

- **Post settings** — title, auto-generated slug (editable), tags, excerpt,
  and a featured toggle.
- **Write / Preview tabs** — distraction-free Markdown editor with a live
  rendered preview (headings, lists, code blocks, quotes, links, images).
- **Word count + reading time** in the tab bar.
- **Copy Markdown + frontmatter** — one click, ready to paste into a Ghost
  Markdown card.
- **Copy frontmatter only** and **Download .md** for imports.
- **Draft autosave** — your work survives closing the popup.

Frontmatter follows common YAML conventions:

```yaml
---
title: "My Post"
slug: my-post
tags: [news, tutorial]
excerpt: "One or two sentences…"
featured: false
date: 2026-10-16
---
```

## Install

**Chrome / Edge**
1. Unzip the release archive.
2. Open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

**Firefox**
1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on** and select `manifest.json`.
3. Note: temporary add-ons lose stored data on browser restart.

**Opera** — same steps as Chrome via `opera://extensions`.

## Permissions

| Permission | Why |
|---|---|
| `storage` | Autosaves your draft on-device. |
| `clipboardWrite` | Copies the Markdown / frontmatter to your clipboard. |

No host permissions. No network calls. Nothing leaves your device.

## Publishing notes

- Manifest V3, no deprecated APIs.
- The Markdown renderer is hand-written and fully offline — no bundled
  third-party libraries, no remote code.
- Minimal permissions, all justified in the store privacy disclosure.
