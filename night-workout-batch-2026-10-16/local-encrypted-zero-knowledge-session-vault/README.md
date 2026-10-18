# Session Vault — Encrypted Tab Sessions

Save full browser windows as **encrypted** sessions. Everything is sealed with AES-256-GCM, keyed by a passphrase you choose. The extension is **zero-knowledge**: without your passphrase, the stored data is unreadable — even to us.

## How it works

1. **Create vault** — pick a strong passphrase (8+ characters; longer is better).
2. **Save current window** — all saveable tabs are collected, encrypted, and stored.
3. **Unlock** with your passphrase to see session names, restore them into a new window, or delete them.
4. **Lock** — or just close the popup. The key lives in memory only and is dropped when the popup closes (auto-lock).

## Cryptography

- Key derivation: PBKDF2-SHA-256, 600,000 iterations, 16-byte random salt.
- Encryption: AES-256-GCM with a fresh 12-byte IV per session.
- The derived key is **non-extractable** and never written to storage.
- Storage holds only: salt, an encrypted canary (for passphrase verification), and encrypted session blobs — session **names and dates are encrypted too**.

## Honest scope

- Security depends on your passphrase strength. A weak passphrase can be brute-forced.
- **Lose the passphrase = lose every session.** There is no recovery, no backdoor, no "forgot password" flow. The wipe button deletes everything so you can start over — it cannot recover data.
- Sessions are stored in `chrome.storage.local` on this device only. Uninstalling the browser profile or clearing extension data destroys them.
- Internal browser pages (`chrome://`, `about:`) cannot be saved or restored by extensions.

## Permissions

- `storage` — encrypted blobs only.
- `tabs` — read the current window's tabs when *you* click Save; `windows.create` opens restores in a new window.

100% local. Zero network. No telemetry, no accounts, no cloud.
