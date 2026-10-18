# LinkNotes — Cross-Reference Tagger

Wiki-style notes in your popup: link notes together with `[[Note Name]]`, follow links with one click, see backlinks, and export everything as Markdown.

## What it does

- **Notes list** — search, create, and open notes; each card shows link count, backlink badges, and last-edited date.
- **Wiki-style links** — type `[[Other Note]]` anywhere in a note body. In Preview mode links become clickable pills: existing notes open instantly, missing ones offer to create the note.
- **Backlinks** — every note shows which other notes link to it, with one-click jump.
- **Edit / Preview tabs** — draft in plain text, preview rendered links.
- **Markdown export** — export one note or all notes (alphabetical, separated by `---`) as `.md` downloads.
- **Ctrl/Cmd+S** saves inside the editor.

Everything is stored in `chrome.storage.local` on your device. No network calls, no accounts, no tracking.

## Install

**Chrome / Edge**
1. Unzip the package.
2. Open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

**Firefox**
1. Open `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on**.
2. Select `manifest.json` in the unzipped folder. (Temporary: reload after each browser restart.)

## Permissions

| Permission | Why |
|---|---|
| `storage` | Stores your notes locally. Nothing else is stored or transmitted. |

No host permissions, no content scripts, no background page. Downloads use an in-page blob anchor (no `downloads` permission needed).

## Honest scope

- Link matching is by exact title (case-insensitive). Renaming a note does not auto-update links pointing at the old title — those become "missing" pills you can click to recreate.
- Notes live in the browser profile's local storage; use Export for backups.

## Publishing notes

- Manifest V3, single permission (`storage`), no remote code, no data collection — low review friction on the Chrome Web Store.
- Screenshots: notes list with linked cards, editor with Preview tab showing rendered `[[links]]`, backlinks panel.
