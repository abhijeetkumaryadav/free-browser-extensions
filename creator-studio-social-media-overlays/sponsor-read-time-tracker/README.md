# Sponsor Read Time Tracker v1.0.0

A manual time tracker for sponsored content. Add sponsors or campaigns, start/stop a timer per sponsor, log sessions with notes, see per-sponsor totals, and export a CSV report for invoicing.

## Honest scope
This is a **manual tracker** — timers are started and stopped by you. It does not detect sponsored content automatically, and all data stays on this device.

## Features
- Add / delete sponsors or campaigns
- One-click start/stop timer with live HH:MM:SS display
- Running timer persists while the popup is closed (timestamp-based)
- Per-session notes
- Per-sponsor totals and recent session history
- One-click CSV export (`sponsor,started_at,ended_at,duration_seconds,duration_hms,note`)

## Install
**Chrome / Edge:** unzip the file, open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**, click **Load unpacked**, select the unzipped folder.
**Firefox:** open `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → select `manifest.json`. (Temporary install; for permanent use, sign via addons.mozilla.org.)
**Opera:** open `opera://extensions`, enable **Developer mode**, **Load unpacked**.

## Permissions
| Permission | Why |
|---|---|
| `storage` | Save sponsors, sessions, and the running timer on-device |

No host permissions. No network calls. No remote code.

## Publishing notes
- Manifest V3, no deprecated APIs.
- Single `storage` permission — minimal and easily justified in store review.
- Privacy policy: no data collection, no transmission, no analytics.
