# Posture Prompt — Pelvic Tilt & Desk Reset Reminders

A configurable posture reminder extension with guided wellness routines.

## What it does

- Toggle reminders on/off and set the interval (10–120 minutes).
- On each interval, a notification prompts you with a routine from the bundled list:
  - **Pelvic Tilt Reset** — gentle standing pelvic tilts
  - **Sit–Stand Cycle** — stand, roll shoulders, 60-second walk
  - **Neck & Shoulder Ease** — side tilts, blade squeezes, rolls
  - **Desk Ergonomics Reset** — monitor/elbows/feet checklist
- Enable or disable individual routines; the reminder picks randomly among enabled ones.
- **Mark done** on the last prompt and keep a 100-entry done log.
- "Test a reminder now" fires one immediately.

## Honest scope

**Reminders only — not medical advice.** These are plain-text wellness descriptions. Stop any movement that causes pain, and consult a professional if you have an existing condition. The extension makes no diagnosis, recommendation, or treatment claim.

## Privacy

- 100% local. Permissions: `storage` (settings, log), `alarms` (interval scheduling), `notifications` (reminders).
- No network, no analytics, no accounts.

## Files

- `manifest.json` — Manifest V3
- `background.js` — alarm scheduling, notification firing, routine pool
- `popup.html` / `popup.css` / `popup.js` — 380px glassmorphism control panel
- `icons/` — generated 16/48/128 PNG icons

## Install (developer mode)

1. Open `chrome://extensions`, enable Developer mode.
2. "Load unpacked" → select this folder. Or install the `.zip` via your browser's extension page.
