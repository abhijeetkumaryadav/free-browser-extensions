# ZK Vault — Offline Encrypted Data Vault

A password-protected, fully offline encrypted vault for notes and secrets.

## Honest scope

**This is a local AES-256 encrypted store — NOT cryptographic zero-knowledge proofs.**
The name refers to the privacy posture ("zero knowledge" leaves the device), not
ZK-SNARKs or similar cryptography. The popup and UI state this explicitly.

## How it works

- Master password → **PBKDF2-SHA256 (250,000 iterations)** → **AES-256-GCM** key (WebCrypto).
- A random 16-byte salt and an encrypted verifier are the only things persisted in
  `chrome.storage.local`. The password itself is never stored.
- The derived key lives in `chrome.storage.session` (in-memory only, wiped on
  browser restart) and is cleared by the auto-lock alarm (1 / 5 / 15 / 60 min).
- Each entry is encrypted with a fresh random 96-bit IV.
- **Zero network calls.** No analytics, no sync, no external requests.

## Features

- Create vault / unlock with master password
- Add, edit, delete, search entries (title, username, secret, notes)
- Show/hide and one-click copy of secrets
- Configurable auto-lock timer
- Full vault reset (with confirmation)

## Permissions

- `storage` — persist the encrypted vault locally.
- `alarms` — run the periodic auto-lock check.

## Install (developer mode)

1. Open `chrome://extensions`, enable **Developer mode**.
2. **Load unpacked** → select this folder.
3. Pin the extension and click its toolbar icon.

## Notes

- If you forget the master password, the vault **cannot** be recovered — by design.
- Development build: logic validated with unit-style checks; not yet tested in a
  live browser session.
