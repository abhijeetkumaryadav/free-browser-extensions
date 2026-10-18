# Phishing Wallet Address Blacklist v1.0.0

Check a crypto wallet address against **your own local blacklist** of known phishing / scam addresses — before you send funds.

## Honest scope

- **100% local.** The blacklist lives in `chrome.storage.local`. No remote lookups, no telemetry, no API calls.
- Bundled starter entries are **clearly-marked sample data**, not real threat intelligence. Add your own entries.
- A "not listed" verdict is **not a safety guarantee** — it only means the address isn't on *your* list. Always verify out-of-band.

## Features

- Paste an address → instant BLACKLISTED / not-listed verdict
- Add / remove entries; search the list
- Export / import the list as JSON (shareable, portable)
- Case-insensitive matching

## Permissions

- `storage` — persists your blacklist locally.

## Files

- `manifest.json`, `popup.html`, `popup.css`, `popup.js`
- `icons/icon16.png`, `icons/icon48.png`, `icons/icon128.png`

MV3 only. Chrome / Edge / Firefox / Opera compatible.
