# Dotted — Side Panel Bullet Journal

A bullet journal that lives in your browser's side panel: rapid-log your day
with classic bullet syntax, check off tasks, review the month, and keep a
future log. Everything stays on your device — no accounts, no servers.

## Features

- **Daily log** — rapid logging with type buttons or prefix shortcuts:
  `. task` · `o event` · `- note`. Click a task's `•` to complete it (`×`).
- **Day navigation** — previous/next day arrows plus a Today shortcut.
- **Monthly view** — calendar grid with entry dots; click a day to jump to it,
  with a grouped list of the month's entries below.
- **Future log** — dated entries for upcoming plans, sorted by date.
- **Search** — full-text search across all entries, grouped by date.
- **Side panel** — opens in Chrome/Edge's side panel (Firefox: sidebars API
  is supported via `sidebar_action` in a future update; the panel opens as a
  popup there — see Publishing notes).

## Install

1. Unzip `side-panel-bullet-journal.zip`.
2. Open `chrome://extensions` (Edge: `edge://extensions`), enable
   **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.
4. Open the side panel (toolbar → side panel icon, or pin the extension and
   choose "Open side panel").

Firefox: this build targets Chromium's `sidePanel` API. Firefox support would
use `sidebar_action`; not included in this build.

## Permissions

- `sidePanel` — displays the journal in the browser side panel.
- `storage` — persists your journal entries on-device. Nothing is sent
  anywhere.

## Publishing notes

- Manifest V3, no host permissions, no remote code, no network calls.
- Icons are generated PNGs (16/48/128).
- Privacy policy summary: the extension collects no data.
