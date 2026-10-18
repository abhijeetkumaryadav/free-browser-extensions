# Wrist Mobility Reminder

Gentle reminders to do a wrist mobility exercise — for people at keyboards all day.

## What it does

- Toggle reminders on/off and pick an interval (10–180 min).
- A notification fires with a random wrist-mobility exercise from a bundled list of 8 (wrist circles, prayer stretch, finger spreads, …).
- "Mark done" on the notification logs it; the popup shows the last exercise and a done log.

## Honest scope

**Reminders only — NOT medical advice.** This extension does not diagnose, treat, or prevent carpal tunnel syndrome or any condition. See a doctor for wrist pain.

## Privacy

100% local. Nothing is stored outside `chrome.storage.local`, nothing is transmitted.

## Files

- `manifest.json` — MV3, permissions: `storage`, `alarms`, `notifications`
- `background.js` — alarm scheduling + notification engine
- `popup.html` / `popup.css` / `popup.js` — controls and log
- `icons/` — generated PNG icons
