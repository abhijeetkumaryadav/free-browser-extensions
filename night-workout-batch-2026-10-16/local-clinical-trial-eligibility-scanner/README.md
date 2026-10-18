# Trial Notes — Clinical Trial Logbook

A personal logbook for tracking clinical trials you are considering, where you heard about them, and the questions you want to ask your doctor. Fully local, zero network.

## Honest scope

- **Not an eligibility check.** The extension performs no eligibility assessment, screening, or matching against any trial criteria. It is a notes organizer, nothing more.
- Never recommends or interprets trials.

> **Not medical advice — talk to your doctor/pharmacist.**

## Features

- Log trials: name, source, questions for your doctor, status (considering / contacted / enrolled / declined)
- Inline status changes per trial
- Instant search across name, source, and questions
- Per-entry delete, clear-all (with confirm)
- Export all entries as JSON
- Entries persist in `chrome.storage.local`

## Privacy

- 100% local. Nothing is uploaded, sent, or shared.
- Only permission: `storage` (to save your entries).

## Install (developer mode)

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select this folder

## Files

- `manifest.json` — Manifest V3
- `popup.html` / `popup.css` / `popup.js` — popup UI and logic
- `icons/` — generated PNG icons (16/48/128)

## Version

1.0.0 — Initial release.
