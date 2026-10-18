# WatchSync — Anime Watchlist Tracker (v1.0.0)

A manual anime watchlist tracker in your browser toolbar. Add series, log watched
episodes with **+/- steppers**, see **progress bars**, set a **status**
(Watching / Completed / On Hold / Dropped / Plan to Watch), give a **star rating**,
search/filter your list, and **export/import** everything as JSON.

> **Honest scope:** this is a *manual* tracker. It is **not** connected to
> MyAnimeList or Crunchyroll accounts and does not scrape any service. You enter
> your own data; it stays on your device.

## Install

**Chrome / Edge**
1. Unzip the package.
2. Go to `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

**Firefox**
1. Go to `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on**.
2. Select `manifest.json` inside the folder.

## Permissions

| Permission | Why |
|---|---|
| `storage` | Saves your watchlist on-device via `chrome.storage.local`. Nothing else. |

No network calls are made — ever.

## Features

- Add series with title + total episodes
- +/- steppers for watched episodes (auto-marks Completed at 100%)
- Animated progress bars with percentage
- 5 statuses, 5-star ratings (click again to clear)
- Search + status filter, stats row (series / watching / completed / episodes watched)
- Edit dialog: rename, change total, change status, delete
- JSON export (download) and import (merges, skips duplicates)

## Publishing notes

- Manifest V3, no remote code, no analytics.
- Minimal permission (`storage` only) — easy privacy review.
- Not affiliated with MyAnimeList or Crunchyroll.
