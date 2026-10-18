# Step Pace Log — Manual Step/Pace Logger

**Manual log — not a device sync.** Extensions have no access to treadmill or
step-counter hardware, so you enter your steps and minutes yourself and the
extension computes your pace.

## What it does

- Log sessions with **steps + minutes**
- Per-session **pace (steps/min)**
- Running **totals**: total steps, total minutes, overall pace, session count
- Per-session delete, clear-all, data persists in `chrome.storage.local`
- 100% local — no network, no permissions beyond `storage`

## Files

- `manifest.json` — MV3 manifest
- `popup.html` / `popup.css` / `popup.js` — popup UI and logic

## Install

1. Open `chrome://extensions`, enable Developer mode
2. Load unpacked → select this folder (or install the `.zip`)
