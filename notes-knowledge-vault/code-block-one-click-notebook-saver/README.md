# CodeVault — Code Block Notebook Saver

Find every code block on a page and save any of them to a named notebook in one
click. Perfect for collecting snippets from docs, Stack Overflow, and tutorials.

## Features

- **Scan page** — detects all `<pre><code>` / `<pre>` blocks with language labels
  (from `language-*` classes, highlight.js tokens, or `data-language` attributes)
- **One-click save** — pick a notebook from the dropdown, save the full code block
  with its source page URL and title
- **Notebooks** — create/rename-free named notebooks, browse snippets, copy to
  clipboard, delete individually or wipe a whole notebook
- **Export Markdown** — each notebook exports as `.md` with fenced code blocks
  and source links
- Blocks over 200 KB are truncated with a note, to keep storage light

## Install

1. Unzip the package.
2. Open `chrome://extensions` (Edge: `edge://extensions`).
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the unzipped folder.
5. For Firefox: `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → pick `manifest.json`. (MV3 `world: "MAIN"` scripting works in Firefox 128+.)

## Permissions

| Permission | Why |
|---|---|
| `storage` | Notebooks and snippets live on your device |
| `activeTab` + `scripting` | Scan code blocks on the page you are viewing, only when you click Scan |

No host permissions, no background network calls, no data leaves your device.

## Honest limits

- Language detection is heuristic (class names / data attributes); unknown blocks are labeled `text`.
- Pages that render code in canvas or images have nothing to detect.
- Cannot scan `chrome://`, `edge://`, `about:` or Web Store pages (browser restriction).
- No syntax highlighting — blocks render in clean monospace.

## Publishing notes

- Manifest V3, no deprecated APIs, no remote code (the page scanner is bundled).
- Single accent color (cyan `#22d3ee`), Lucide-style stroke icons.
- Privacy: everything is local; the store privacy disclosure is "no data collected".
