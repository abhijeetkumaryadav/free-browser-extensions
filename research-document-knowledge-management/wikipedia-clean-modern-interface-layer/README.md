# WikiClean — Modern Reading Layer for Wikipedia

A clean, modern reading mode for Wikipedia articles: better typography, a comfortable
column measure, dark / light / sepia themes, and optional distraction-free layout
(hide sidebar, table of contents, and top header).

## What it does

- Toggle a reading layer on any `*.wikipedia.org` page
- Light, dark, and sepia themes with a card-style treatment for infoboxes, tables, and images
- Adjustable body font size (14–24px)
- Independent toggles for the sidebar, table of contents, and top header
- Preferences are remembered **per wiki** (e.g. `en.wikipedia.org` vs `de.wikipedia.org`)
- 100% CSS — disabling the toggle restores the original page exactly

## Honest limits

- Applies only to `wikipedia.org` domains (host permission scoped accordingly)
- Sites with heavy custom JS widgets are unaffected beyond styling
- Does not modify article content, only presentation

## Install (unpacked)

**Chrome / Edge:**
1. Unzip `wikipedia-clean-modern-interface-layer.zip`
2. Open `chrome://extensions` (or `edge://extensions`)
3. Enable **Developer mode**
4. Click **Load unpacked** and select the unzipped folder

**Firefox:**
1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on** and select `manifest.json`

**Opera:** same as Chrome via `opera://extensions`.

## Permissions

| Permission | Why |
|---|---|
| `storage` | Save your per-wiki theme/layout preferences on-device |
| Host access to `*.wikipedia.org` | Inject the CSS-only reading layer into Wikipedia pages |

No network requests, no analytics, no data leaves your device.

## Publishing notes

- Manifest V3, no deprecated APIs
- Minimal, justified permissions (storage + wikipedia.org host access)
- No remote code: all CSS/JS is bundled
