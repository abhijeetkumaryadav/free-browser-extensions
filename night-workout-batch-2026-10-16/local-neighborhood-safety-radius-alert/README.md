# SafetyRadius — Manual Check-In Buddy

A **manual** personal-safety companion. Set named safety zones (plain text labels you invent), start a countdown check-in timer, and get escalating reminders if you don't check in. Keep emergency contacts and per-place notes at a glance.

## What it does

- **Named places** — "Home", "Elm St evening walk", "Night shift". A place is just a label; the extension never sees your location.
- **Check-in timers** — pick 15m / 30m / 1h / 2h. Pressing "I'm safe — check in" re-arms the timer for another interval.
- **Escalating alerts** — when a timer lapses, you get a high-priority notification, then reminder nudges every 5 minutes until you check in.
- **Emergency contacts** — stored locally and shown in the overdue notification so you know who to call.
- **Per-place notes** — free-text reminders tied to each place.

## Honest scope (please read)

- This is a **manual check-in buddy**, not a safety service.
- It does **not** show live crime data, it does **not** use GPS or geolocation, and it does **not** contact anyone — no auto-dialing, no SMS, no emails.
- Alerts appear on this device only. It cannot replace a trusted person knowing where you are.
- All data (places, contacts, timers) is stored in `chrome.storage.local` — 100% local, zero network calls.

## Install

1. Open `chrome://extensions`, enable **Developer mode**.
2. Click **Load unpacked** and select this folder.

## Permissions

- `storage` — keep your places, contacts, and timer state locally.
- `alarms` — schedule check-in due times and escalation nudges.
- `notifications` — show overdue check-in alerts.

## Files

- `manifest.json` — MV3 manifest
- `popup.html` / `popup.css` / `popup.js` — 380px glassmorphism popup UI
- `background.js` — service worker: alarm handling + escalating notifications
- `icons/` — 16/48/128 PNG icons

No content scripts, no remote code, no tracking.
