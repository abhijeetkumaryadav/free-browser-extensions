# JWT Session Vault — Client-Side Cryptographic Token Vault

Decode, HMAC-verify, and safely store **your own** JWTs — everything runs
locally in the browser via WebCrypto. Nothing is ever transmitted anywhere.

## Features

- **Decode** — paste any JWT to see header claims, payload claims (with
  plain-language hints for `exp`, `iat`, `iss`, …) and a live expiry countdown.
- **Verify signature** — enter the HMAC secret to verify HS256/HS384/HS512
  signatures with SubtleCrypto (constant-time comparison). Non-HMAC `alg`
  values are reported as unverifiable instead of failing silently.
- **Vault** — save named tokens in `chrome.storage.local`; load them back into
  the inspector with one click; per-token delete; expiry countdown per entry
  (expired tokens are flagged).
- **Passphrase lock (optional)** — encrypts the whole vault with AES-GCM using
  a PBKDF2-derived key (210,000 iterations, random salt + IV per encryption).
  The passphrase is session-only and never persisted.

## Honest scope

- Stores **your** tokens only — it does not read tokens from websites or other
  tabs, and it cannot manage other apps' sessions.
- HMAC verification proves the token was signed with your secret; it does not
  prove the token is accepted by any server.
- No key recovery: if you forget the vault passphrase, the encrypted vault
  cannot be opened.

## Files

- `manifest.json` — MV3 manifest (permission: `storage` only)
- `popup.html` / `popup.css` / `popup.js` — inspector + vault UI
- `crypto.js` — base64url, JWT parse, HMAC verify, AES-GCM vault encryption
  (pure functions between `// ENGINE-START` / `// ENGINE-END`, headless-tested)
- `icons/` — 16/48/128 PNG icons
- Zero network requests, no analytics.

## Install

1. Open `chrome://extensions`, enable Developer mode.
2. "Load unpacked" → select this folder.
3. Paste a JWT, decode, optionally verify and save it.
