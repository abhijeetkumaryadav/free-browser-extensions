# Medicine Notes — Personal Notebook

A personal notebook for logging medicine names with their chemical/formula names and your own notes. Fully local, zero network.

## Honest scope

- **Your notes — not a formula database.** The extension ships with no drug or formula data and performs no lookups, matching, or verification. Everything is typed by you.
- Never recommends, suggests, or compares medicines.

> **Not medical advice — talk to your doctor/pharmacist.**

## Features

- Add entries: medicine name, chemical/formula name, free-text notes
- Instant search across name, formula, and notes
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
