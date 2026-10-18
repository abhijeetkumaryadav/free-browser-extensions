# Session Backup Restorer v1.0.0

Automatically snapshots all open tabs and windows every 30 minutes, then restores any snapshot into a new window with one click. Your sessions survive crashes, restarts, and Monday-morning tab purges — everything stays on your device.

## Features

- **Auto-backup** — a 30-minute background alarm snapshots every window + tab (URL, title, pinned state, favicon).
- **Snapshots on launch** — also captures a snapshot at browser start and right after install.
- **One-click restore** — opens the snapshot in a new window; pinned tabs are re-pinned, incognito restores as incognito. Your current tabs are never touched.
- **Keeps newest 20** — old snapshots roll off automatically.
- **JSON export / import** — move sessions between computers or keep a file backup. Imports are deduplicated by snapshot ID.
- **Safe restore** — `chrome://`, `about:`, and other non-web URLs can't be reopened by extensions and are skipped silently.

## Install

### Chrome / Edge
1. Unzip `session-backup-restorer.zip`.
2. Go to `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
3. **Load unpacked** → select the unzipped folder.

### Firefox
1. Go to `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → pick `manifest.json`.
2. Note: Firefox supports alarms + tabs + storage; temporary add-ons lose the background state on restart, so snapshots persist in storage but alarms re-arm on next install.

### Opera
Same as Chrome via `opera://extensions` with Developer mode enabled.

## Permissions (justified)

| Permission | Why |
|---|---|
| `tabs` | Read tab URLs/titles/favicons to build snapshots, and re-pin tabs on restore. |
| `storage` | Save the last 20 snapshots on-device. Nothing leaves your computer. |
| `alarms` | Fire the 30-minute snapshot timer reliably in the MV3 service worker. |

No host permissions, no network access, no analytics. The export feature creates a download only when **you** click Export.

## Publishing notes

- MV3, no deprecated APIs.
- Privacy practice to declare (Chrome Web Store): "Session data (tab URLs, titles) stored locally on the device only; never transmitted."
- Screenshots: popup showing 2–3 snapshots with Restore buttons; before/after of a restore.
