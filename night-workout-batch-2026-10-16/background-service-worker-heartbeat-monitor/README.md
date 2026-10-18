# Heartbeat Monitor — Service Worker Health

**Honest scope:** Monitors **this extension only**. Browsers do not let extensions
inspect other extensions' service workers — so this is an own-health dashboard,
not a global worker monitor.

## What it does

- Logs a heartbeat every minute via `chrome.alarms` (alarms wake the sleeping worker)
- Shows worker status (awake / sleeping), last heartbeat, uptime since install,
  heartbeat count in the last 24 h, and a storage-usage estimate
- Recent heartbeat log (last 20) and a "Ping now" button for an immediate heartbeat

## Why workers "sleep"

Manifest V3 service workers are intentionally short-lived — the browser stops them
when idle and restarts them on events/alarms. "Sleeping" is normal, not an error.

## Files

- `manifest.json` — MV3, permissions: `storage`, `alarms`
- `background.js` — alarm registration + heartbeat logging
- `popup.html` / `popup.css` / `popup.js` — dashboard UI
- `icons/` — generated PNG icons

## Load it

1. `chrome://extensions` → Developer mode → Load unpacked → select this folder.
2. Click the toolbar icon to see your worker's health.
