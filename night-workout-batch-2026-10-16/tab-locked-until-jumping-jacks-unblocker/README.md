# Break Gate — Movement Unlock Timer

**Honor system — exercise can't be verified.** Extensions have no way to know
whether you actually did jumping jacks, so this is a timed gate: lock the
current tab behind a 1–5 minute movement break, then it unlocks.

## What it does

- Lock the current tab behind a **1–5 minute movement break** (you choose)
- Full-screen overlay with a live countdown on the locked tab
- **Chime** (generated Web Audio tone, no files) when the break completes
- Timer runs in the **background worker** via alarms — survives popup close
- Completion **notification** if the popup is closed
- **End break early** button; counter of completed breaks
- Cannot lock browser-internal pages (`chrome://`, Web Store)

## Honest scope

- Honor system — nothing verifies you exercised
- Not medical or fitness advice

## Files

- `manifest.json` — MV3 manifest
- `background.js` — timer engine (alarms), overlay injection, cleanup
- `popup.html` / `popup.css` / `popup.js` — popup UI, countdown mirror, chime

## Install

1. Open `chrome://extensions`, enable Developer mode
2. Load unpacked → select this folder (or install the `.zip`)
