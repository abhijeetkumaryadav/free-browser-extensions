# WatchLog — Watch History Exporter

A manual watch-history log for movies and shows: one click saves the current tab's title + URL with a timestamp, and you can export everything as a CSV formatted for Trakt-style import.

## Honest scope

- **No Trakt API.** This extension never talks to Trakt or any service. There is no automatic detection of what you watch.
- You press **"Log this tab"** when you finish something; the extension records the tab's title, URL, a timestamp, and a best-guess year parsed from the title.
- The CSV export uses the columns `title, year, type, watched_at, url` — a layout compatible with common Trakt list importers. Adjust the file before importing if your importer expects different headers.

## Features

- **One-click logging** — current tab title + URL + timestamp
- **Edit titles / years** — fix anything before export
- **Movie/show toggle** — mark each entry correctly
- **Search** across your history
- **CSV export** (oldest first) via in-page download — no `downloads` permission needed
- **Clear all** with confirmation

## Install

**Chrome / Edge:**
1. Unzip the package.
2. Open `chrome://extensions` (or `edge://extensions`) and enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

**Firefox:**
1. Open `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on**.
2. Select `manifest.json` from the unzipped folder.
   - Note: temporary in Firefox; for permanent install the add-on must be signed via addons.mozilla.org.

## Permissions — why each is needed

| Permission | Justification |
|---|---|
| `storage` | Saves your log entries on-device only |
| `activeTab` | Reads the title/URL of the tab you explicitly choose to log |

No data leaves your device. No network calls. No analytics.

## Publishing notes

- Chrome Web Store / Edge Add-ons: standard MV3 listing; single purpose is "manual watch history logging with CSV export". No remote hosts, no OAuth.
- Firefox: requires AMO signing; no host permissions requested.
