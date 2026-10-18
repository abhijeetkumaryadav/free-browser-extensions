# Session Integrity Vault (`zero-knowledge-proof-session-state-authenticator`)

Signed, integrity-checked tab-session exports.

## What it does

1. **Unlock** with a passphrase → derives an HMAC-SHA-256 key via PBKDF2-SHA-256
   (600,000 iterations). A canary signature confirms the passphrase on later unlocks.
2. **Export** the current window's tabs as a signed JSON file (fresh canonical payload,
   HMAC signature, salt, algorithm label).
3. **Verify** a signed file on re-import: the signature is checked before anything is
   trusted. Only verified files can be **restored** (into a new window, never touching
   your current tabs).

## What it does NOT do

- This is **not zero-knowledge cryptography** and does **not encrypt** your URLs —
  the export file is plaintext JSON plus a signature. The HMAC proves the file hasn't
  been tampered with; it does not hide its contents.
- The key is memory-only and non-extractable; locking or closing the popup forgets it.
  There is no passphrase recovery.

## Security notes

- Strength depends entirely on your passphrase.
- Export files are readable by anyone with file access — they prove integrity, not secrecy.

## Privacy

100% local. Permissions `storage` + `tabs` only. No network calls, no remote code.

## Files

`manifest.json`, `popup.html`, `popup.css`, `popup.js`, `crypto.js` (Web Crypto helpers),
`README.md`, `icons/`.
