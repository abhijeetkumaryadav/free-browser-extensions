# Schema Doc Generator

**Slug:** `airtable-view-schema-documenter` · **Version:** 1.0.0 · **Manifest V3**

Turn a pasted field list into clean Markdown schema documentation with a table of contents, field-type badges, one-click copy, and `.md` download. Pure offline tool.

## Features

- Paste fields as `Name | Type` lines, CSV (`name, type`), or bare names
- Auto-classifies common field types (text, number, select, date, checkbox, link, media, formula…); unknown types kept as "Custom"
- Live preview with color-coded type badges
- Generates Markdown with title, field count, table of contents, field table, and per-field sections
- Copy Markdown to clipboard or download as `.md`
- Remembers your last document locally

## Install (developer mode)

**Chrome / Edge:**
1. Unzip the release ZIP.
2. Go to `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

**Firefox:**
1. Unzip the release ZIP.
2. Go to `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on**.
3. Select `manifest.json` inside the unzipped folder. (Temporary installs are removed on browser restart.)

## Permissions (justified)

| Permission | Why |
|---|---|
| `storage` | Remembers your last field list and table name between sessions. |
| `clipboardWrite` | Lets the "Copy Markdown" button write to your clipboard. |

No host permissions, no network calls, no remote code.

## Privacy

All parsing and document generation runs locally in the popup. Nothing is sent anywhere.

## Publishing notes

- MV3, no deprecated APIs.
- Safe for Chrome Web Store / Edge Add-ons / Firefox AMO review.
- Store listing: describe as a database schema documentation helper; it does not integrate with Airtable's API.

## Files

- `manifest.json` — MV3 manifest
- `popup.html` / `popup.css` / `popup.js` — UI, styling, parser + generator
- `icons/` — generated 16/48/128 PNG icons
- `airtable-view-schema-documenter.zip` — packaged release
