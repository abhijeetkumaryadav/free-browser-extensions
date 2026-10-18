# Vacancy History Tracker v1.0.0

Track job applications through a real pipeline: **saved → applied →
interview → offer / rejected**. Each application keeps a full status
history, viewable per-job or in a global timeline view. Per-status
counts double as filters. Set a follow-up date on any active
application and get a system notification reminder at 9am that day;
overdue follow-ups get a red "Follow up!" badge.

## Try it
1. Unzip `vacancy-history-tracker.zip`.
2. `chrome://extensions` → Developer mode → **Load unpacked** → select folder.
3. Click the icon → **＋ New** to add an application.
4. Firefox: `about:debugging` → This Firefox → Load Temporary Add-on → select `manifest.json`.

## Permissions
- `storage` — applications and history live on-device; nothing uploaded.
- `alarms` — schedule follow-up reminders (re-created on startup).
- `notifications` — show the follow-up reminder.

## Publishing notes
- Chrome Web Store: $5 one-time dev fee. All three permissions are
  core to the reminder feature; the listing description must say so.
