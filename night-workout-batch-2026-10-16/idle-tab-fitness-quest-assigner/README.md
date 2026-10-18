# Idle Quest Assigner

A gentle nudge to move. When your browser goes idle, this extension assigns
one random movement quest from a bundled list of 12 equipment-free exercises
via a notification. Tap **Mark done** to log it.

## What it does

- Watches `chrome.idle` state; fires at most one quest per idle window.
- Notification carries the quest plus a **Mark done** button.
- Popup: enable/disable toggle, idle threshold (5–120 min), "Send a quest now"
  test button, and a done log with timestamps.

## Honest scope

- **Reminders only — not medical advice.** Stop any movement that causes pain.
- Fully local. No network, no accounts, no analytics.
- Minimal permissions: `storage` (settings/log), `idle` (detection),
  `notifications` (quest delivery).

## Files

- `manifest.json` — Manifest V3
- `background.js` — idle watcher + quest dispatcher
- `popup.html` / `popup.css` / `popup.js` — settings UI
- `icons/` — generated 16/48/128 PNG icons

## Install

1. Open `chrome://extensions`, enable Developer mode.
2. **Load unpacked** → select this folder (or install the `.zip` via your
   browser's extension tooling).
