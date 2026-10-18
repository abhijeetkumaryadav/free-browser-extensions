# StudyGate — Study to Unlock YouTube

A family study incentive, built as a Chrome/Edge MV3 extension.

## What it does
- The kid runs a **study timer** from the popup toward a parent-set daily goal (default 25 min).
- Until the goal is met, configured video sites (YouTube domains by default) show a friendly **locked overlay** with a live countdown.
- **Parent PIN** (salted SHA-256, stored locally) guards settings: goal minutes, extra locked sites, PIN changes.
- **Progress dashboard**: day streaks 🔥, best streak, goals completed, last-7-days bars.
- Toolbar badge shows minutes remaining while studying, `OPEN` when unlocked.

## Honest scope
This is a **family agreement aid, not a lock-down tool** — a tech-savvy kid can bypass any browser extension (disable it, use another browser, etc.). It works best as part of an agreed routine, not as enforcement. 100% local: no accounts, no servers, nothing leaves the device.

## Permissions
- `storage` — timer state, settings, PIN hash, history (all local).
- `alarms` — 1-minute study ticks and day rollover; survives popup closes.
- `scripting` + host permissions — inject the lock overlay only on configured sites.
- `optional_host_permissions` — parent-approved extra sites, granted explicitly via Chrome's permission prompt.

## Timer details
- Ticks credit at most 120 s per minute-tick, so sleep/hibernate can't inflate study time.
- Offline time while the browser is closed is never credited.
- Day rollover at local midnight settles streaks (streak continues only if yesterday's goal was met).

## Install (developer mode)
1. Open `chrome://extensions`, enable **Developer mode**.
2. **Load unpacked** → select this folder.
3. Pin StudyGate, open the popup, set the parent PIN first.

## Files
- `manifest.json` — MV3 manifest
- `popup.html` / `popup.css` / `popup.js` — study view + PIN-gated parent settings
- `background.js` — service worker: timer, rollover, streaks, badge
- `content.js` — friendly lock overlay on configured sites
- `icons/` — generated PNG icons (16/48/128)
