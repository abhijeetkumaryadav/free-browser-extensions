# Calisthenics Progression Tree

Interactive progression grids for bodyweight training. 100% local — nothing leaves your browser.

## What it does

Four progression paths, each ordered easiest → hardest:

- **Push** — Wall Push-up → … → One-Arm Push-up (8 steps)
- **Pull** — Dead Hang → … → Muscle-Up (8 steps)
- **Legs** — Assisted Squat → … → Weighted Pistol (8 steps)
- **Core** — Dead Bug → … → Full L-Sit (8 steps)

Click any step to mark it unlocked (click again to unmark). Each path shows an
`x / 8 unlocked` count and a progress bar. "Reset this path" clears that path's
marks. Your marks and the active tab persist in `chrome.storage.local`.

Keyboard accessible: Tab to a step, press Enter/Space to toggle.

## Honest scope

This tracks **your** progress — it is **not coaching**. It does not assess your form,
readiness, or safety for any movement. Progress at your own pace and consult a
qualified coach or clinician for form guidance and medical advice.

## Privacy

All data lives in `chrome.storage.local` on your device. No network requests, no
accounts, no analytics.

## Install (developer mode)

1. Open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
2. Click **Load unpacked** and select this folder — or install the provided `.zip`.
3. Pin the extension and open the popup to start tracking.

## Files

- `manifest.json` — Manifest V3, `storage` permission only
- `popup.html` / `popup.css` / `popup.js` — the progression grid UI
- `icons/` — generated PNG icons (16/48/128)
