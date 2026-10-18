# Medication Schedule Tracker

Personal medication schedule reminders. **Not medical advice — follow your doctor's prescription.**

## What it does
- You add your own medications with dose labels and times (e.g. `08:00, 20:00`).
- `chrome.alarms` fires a notification at each scheduled time, even with the popup closed.
- Check off each dose in "Today's doses"; daily check-offs build a streak.
- Stats: taken today, day streak, total check-offs. Remove a medication any time.

## Honest scope
- Stores only what **you** enter. It **never** suggests medications, doses, or schedules.
- Banner in the popup: *"Not medical advice — follow your doctor's prescription."*

## Files
- `manifest.json` — MV3, permissions: `storage`, `alarms`, `notifications`
- `background.js` — alarm scheduling, notifications, streak math
- `popup.html` / `popup.css` / `popup.js` — add meds, check-off list, stats
- `icons/` — generated PNG icons

## Privacy
100% local. No network calls. All data stays in `chrome.storage.local`.
