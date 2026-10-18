# Outbox Delay Timer v1.0.0

Never forget a follow-up. Log emails you've sent and get a notification when it's time to follow up.

## What it does

- **Log sent emails manually** — recipient + subject, with a follow-up delay (2 days, 1 week, 2 weeks, or custom hours).
- **Due notifications** — a background alarm checks every minute; when a reminder is due you get a notification with **Snooze 1 day** / **Mark done** buttons.
- **Pending list** — sorted by due date, with relative due labels ("in 2d", "3h overdue"), overdue highlighting, per-entry snooze and done.
- **100% on-device** — no mailbox access, no accounts, no network. Your entries never leave the browser.

## Install (development)

**Chrome / Edge**
1. Download and unzip `outbox-delay-timer.zip`.
2. Open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

**Firefox**
1. Open `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on**.
2. Select the unzipped folder's `manifest.json`. (MV3 is supported in Firefox 109+.)

## Permissions (all justified)

| Permission | Why |
|---|---|
| `storage` | Save your follow-up entries on-device. |
| `alarms` | Periodic check (every minute) for due reminders. |
| `notifications` | Alert you when a follow-up is due. |

No host permissions — the extension never touches any website or mailbox.

## Publishing notes

- MV3 only, no deprecated APIs.
- Notifications on Chrome require no extra setup; on macOS the user must allow browser notifications in system settings.
- For the Chrome Web Store listing, disclose: "No data collected; all entries stored locally."
