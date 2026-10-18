# Tab Vault — PIN-Locked Tab Storage

Move tabs into a **PIN-locked vault** stored on-device. Unlock with your PIN
to restore them. Honest scope: real biometrics aren't available to browser
extensions, so this uses a strong PIN gate instead.

## Features

- **Stash this tab / stash all** — closes tabs and stores their URL, title,
  and favicon on-device
- **Restore all in new window** — one click brings everything back
- **Salted SHA-256 PIN hash** — the PIN is never stored in plaintext and
  never leaves the device
- **Failed-attempt lockout** — exponential backoff (5s → 10s → 20s …,
  capped at 5 min) against guessing
- **Auto-lock timer** — Never / 5 min / 15 min / 1 hour; unlock state lives
  in session storage, so a browser restart always re-locks the vault
- **Forgot PIN?** — two-step confirmed wipe (secured tabs are deleted
  permanently — there is no backdoor, by design)

## Install

**Chrome / Edge:** unzip → `chrome://extensions` (or `edge://extensions`) →
enable **Developer mode** → **Load unpacked** → select the folder.

**Firefox:** `about:debugging` → This Firefox → Load Temporary Add-on →
select `manifest.json`. (Temporary installs only unless signed.)

**Opera:** `opera://extensions` → Developer mode → Load unpacked.

## Permissions

| Permission | Why |
|---|---|
| `tabs` | List, close, and restore tabs when you stash / restore them. |
| `storage` | Keep the vault, PIN hash + salt, and settings on-device. |

No network access at all. No data collection, no transmission.

## Publishing notes

- Manifest V3, minimal justified permissions, no remote code.
- Privacy practice disclosure: "Does not collect or transmit any user data."
