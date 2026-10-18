# Form Vault — Local Input History

A per-site opt-in vault that remembers values you type into text fields, so you
can search them later and re-fill forms with one click. **100% local — no network
calls, no accounts, no sync.**

## Honest scope

- Runs **only on sites you explicitly enable** (toggle in the popup). Nothing is
  captured anywhere else.
- **Never captures** passwords, email addresses, phone numbers, numbers, URLs,
  hidden/file/checkbox/radio/color/date fields, or any field whose name, id,
  autocomplete attribute, or placeholder looks sensitive
  (`pass`, `token`, `ssn`, `cvv`, `card`, …).
- Everything is stored in `chrome.storage.local` in your browser profile.
- Keystroke *content* is captured only on form submit (or a 4-second idle
  debounce) — never keylogged live.

## Features

- **Per-site opt-in toggle** for the current tab's hostname.
- **Searchable history** across all saved values, fields, and sites.
- **Per-site view** — the site chip on each entry.
- **One-click re-fill** — sends the saved value back to the matching field on
  the active page.
- **Per-entry delete** and **Clear vault** (with confirm).
- Vault capped at the newest 2,000 entries.

## Permissions

| Permission | Why |
|---|---|
| `storage` | Save the opt-in list and vault entries locally. |
| `scripting` | Inject the capture script into sites you enabled. |
| host permissions `http(s)://*/*` | Only used on hosts you opted in, for the capture script. |

## Files

- `manifest.json` — MV3 manifest.
- `popup.html` / `popup.css` / `popup.js` — popup UI (search, toggle, re-fill, clear).
- `content.js` — page-side capture + re-fill (opt-in sites only).
- `background.js` — service worker; injects the content script on navigation to enabled hosts.
- `icons/` — 16/48/128 PNG icons.

## Development notes

- Run `node --check` on every `.js` file before packaging.
- Load `chrome://extensions` → Developer mode → **Load unpacked** → select this folder.
- Not tested in a live browser beyond syntax/structure validation.
