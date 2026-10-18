# CredLint — Credential Field Security Linter

A **defensive** browser extension that audits login and credential fields on the
current page for common security misconfigurations.

## What it checks

- Password fields missing `autocomplete="current-password"` / `"new-password"`
- `autocomplete="off"` misuse on forms and fields (blocks password managers)
- Login forms submitting with `GET` (credentials in the URL)
- Forms posting to non-HTTPS endpoints
- Pages served over plain HTTP
- Plain-text inputs used where a password is expected
- Very short `maxlength` on password fields
- Login identifiers missing `autocomplete="username"`
- Duplicate password field names, read-only oddities, and more

## Privacy promise (prominent in the popup)

This is a **read-only structural audit**. It inspects page markup and attributes
only. It **never reads, stores, or transmits anything you type** into these
fields. No network requests are made at all.

## Install (developer mode)

1. Open `chrome://extensions`, enable **Developer mode**
2. **Load unpacked** → select this folder
3. Click the CredLint icon, then **Scan this page**

## Permissions

| Permission | Why |
|---|---|
| `activeTab` | Access the currently open tab only when you click Scan |
| `scripting` | Inject the audit script on demand |
| `storage` | Remember your last scan report locally |

## Files

- `manifest.json` — MV3 manifest
- `popup.html` / `popup.css` / `popup.js` — 380px glassmorphism popup
- `content.js` — the audit engine (runs in the page only when you scan)
- `icons/` — generated 16/48/128 PNG icons

## Publishing notes

No remote code, no data collection — suitable for the Chrome Web Store's
privacy requirements. Provide a privacy policy stating no data is collected.
