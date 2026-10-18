# Stretch Prompt — Inactivity Stretch Routine Prompter

Notices when you haven't touched your keyboard or mouse for a while and
gently suggests a short stretch routine. **Reminders only — not medical
advice.** Move gently, and stop if anything hurts.

## What it does

- Watches browser idle state (`chrome.idle`) with a threshold **you** set
  (5 / 10 / 15 / 30 minutes of no keyboard or mouse input).
- When you go idle, shows one gentle notification — never repeated nagging.
- Opening the extension during a pending prompt shows a ~2-minute routine of
  six generic stretches (neck rolls, shoulder shrugs, wrist circles, stand &
  reach, ankle circles, deep breaths). Tap steps as you finish, or **Skip**.
- Tracks how many routines you've completed.

Everything runs locally. No network calls, no data leaves your machine.

## Honest scope

- Detects inactivity, not your posture, health, or anything medical.
- Stretches are generic everyday movements — no medical claims.
- "Later" or dismissing the notification clears the prompt.

## Files

| File | Purpose |
| --- | --- |
| `manifest.json` | Manifest V3 config |
| `popup.html` / `popup.css` / `popup.js` | Settings + routine UI |
| `background.js` | Idle watcher and notification |
| `icons/` | Extension icons (16/48/128) |

## Permissions

- `storage` — settings, prompt state, completion count.
- `idle` — detect keyboard/mouse inactivity.
- `notifications` — the gentle nudge.
- `alarms` — schedule hygiene (kept for future use).

## Install

Load unpacked in `chrome://extensions` (Developer mode), or install the ZIP.
