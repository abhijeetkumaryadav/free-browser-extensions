# Zero Knowledge Sync Vault

AES-256 encrypted notes vault. **100% client-side** — your password never leaves this device and is never stored anywhere.

## Features

- **AES-256-GCM encryption** via WebCrypto; key derived from your password with **PBKDF2-SHA256 (120,000 rounds)** + random 16-byte salt
- **Zero storage of secrets**: only salt + ciphertext live in `chrome.storage.local`; the password and key exist in memory for the session only
- Lock/unlock, add/edit/delete timestamped notes
- **Export / import** the encrypted blob as JSON for portability (import validates the blob with your current session password first)
- Auto-locks when you close the popup; one-click lock button

## Scope honesty

This is a **local-only** vault — there is no server sync. "Sync" portability is achieved by exporting the encrypted blob and importing it on another machine, then unlocking with the same password. If you lose your password, your notes are unrecoverable — that is the point.

## Install

1. Unzip `zero-knowledge-sync-vault.zip`
2. Open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**
3. Click **Load unpacked** and select the unzipped folder
4. Firefox: `about:debugging` → This Firefox → Load Temporary Add-on → choose `manifest.json`

## Permissions

| Permission | Why |
|---|---|
| `storage` | Persist the encrypted vault blob (salt + ciphertext only) on-device |

No host permissions, no network calls of any kind.

## Publishing notes

- MV3, no remote code, no data collection — declare "no data collected" in the Chrome Web Store privacy section
- The crypto runs entirely in the popup page via the Web Crypto API (no external libraries to bundle or audit)
