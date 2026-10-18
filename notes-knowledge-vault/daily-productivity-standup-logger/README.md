# StandLog — Daily Standup Journal

A polished daily standup journal for your browser toolbar. Write **Yesterday / Today / Blockers** entries, keep a streak, browse a calendar, search everything, and export to Markdown.

## Features

- **Today tab** — three prompted fields (Yesterday, Today, Blockers) with autosave-by-click and per-day persistence
- **Streak counter** — consecutive days with a non-empty entry, shown as a flame badge in the header
- **Calendar tab** — month grid with dots on days that have entries; click any day to view/edit it in a modal
- **Entries tab** — full-text search across all entries, newest first
- **Markdown export** — one click downloads all entries as a clean `.md` file
- 100% offline — everything lives in `chrome.storage.local` on your device

## Install (Chrome / Edge / Opera)

1. Unzip `daily-productivity-standup-logger.zip` anywhere
2. Go to `chrome://extensions` (or `edge://extensions`)
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** and select the unzipped folder
5. Pin the StandLog icon to your toolbar

## Firefox

Firefox supports most MV3 extensions. Go to `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → select `manifest.json`. Note: temporary add-ons are removed on browser restart; for permanent install the extension needs signing via addons.mozilla.org.

## Permissions

| Permission | Why |
|---|---|
| `storage` | Persist your journal entries on-device. No network access is requested or used. |

## Privacy

No accounts, no analytics, no network calls. Your entries never leave your browser.

## Publishing notes

- Manifest V3, no remote code, no external assets
- Minimal single permission (`storage`) — straightforward privacy review
- Screenshots: capture the Today tab and the Calendar tab at 1280×800 for store listings
