# Del-ish Bookmark Manager

A retro tag-based bookmark manager. Save bookmarks with tags, filter by a
tag cloud, search everything, and import/export the classic Netscape
bookmark HTML format.

## Features

- Save the current tab (with tags) or a manual link
- Tag cloud with per-tag counts; click to filter, click again to clear
- Live search over title, URL, and tags
- Per-bookmark delete
- Export to bookmark HTML; import from bookmark HTML
- Syncs via `chrome.storage.sync` where available, falls back to local on
  quota errors or when sync is unavailable
- Fully local — no accounts, no network

## Honest scope

Local + browser sync — **not** the Delicious service. It does not sync to any
Delicious account and has no connection to it.

## Permissions

- `storage` — save bookmarks (sync preferred, local fallback)
- `tabs` — read the current tab's title/URL when you click "Save"

## Build

- Manifest V3, popup-only. Validate with `node --check popup.js`.
- Icons: `icons/icon16.png`, `icons/icon48.png`, `icons/icon128.png` (generated with PIL).
