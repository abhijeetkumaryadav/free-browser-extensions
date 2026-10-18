# Practice Reminder — Streak Keeper

A daily practice reminder with a self-marked streak counter.

## What it does

- Set a daily practice time; the extension fires a notification reminder every day at that time.
- Mark each day's practice done in the popup; the streak counter tracks consecutive done days.
- Toggle the reminder on/off, reset the streak anytime. Everything stays in `chrome.storage.local`.

## Honest scope

**Reminder only — not affiliated with Duolingo.** This extension cannot detect your
Duolingo streak or any activity on duolingo.com; the streak counts days *you* mark done.

## Files

- `manifest.json` — MV3 manifest (permissions: `storage`, `alarms`, `notifications`)
- `popup.html` / `popup.css` / `popup.js` — streak UI, time picker, mark-done flow
- `background.js` — daily alarm scheduling + reminder notification

## Install

1. Open `chrome://extensions`, enable Developer mode.
2. Load unpacked → this folder.
3. Set your reminder time and start your streak.
