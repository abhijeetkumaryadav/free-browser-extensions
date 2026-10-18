# Jaw Unclench Reminder

Gentle reminders to unclench your jaw and release facial tension — for people who hold stress in their jaw.

## What it does

- Toggle reminders on/off and pick an interval (10–180 min).
- A notification fires with a jaw-release prompt from a bundled list of 8 (unclench, lip flutter, jaw circles, temple press, …).
- "Mark done" on the notification logs it; the popup shows the last prompt and a done log.

## Honest scope

**Reminders only — not medical advice.** This extension does not diagnose or treat TMJ, bruxism, or any condition. See a professional for persistent pain.

## Privacy

100% local. Nothing is stored outside `chrome.storage.local`, nothing is transmitted.

## Files

- `manifest.json` — MV3, permissions: `storage`, `alarms`, `notifications`
- `background.js` — alarm scheduling + notification engine
- `popup.html` / `popup.css` / `popup.js` — controls and log
- `icons/` — generated PNG icons
