# Cookie Purger — Redundant Cookie Cleaner

Lists the cookies your browser has stored for the **current site** and lets you
delete selected ones — or all of them with one confirmation.

**Honest scope:** this extension only ever touches **your browser's cookies**
for the site in the active tab. It cannot see cookies for other sites, and it
cannot clean anything remotely. **Deleting cookies may log you out** of the
site — the popup warns you before every deletion.

## How it works

1. Open the popup on any site → the extension reads `chrome.cookies` for that
   site's domain (including subdomains).
2. Tick individual cookies (or Select all) → **Delete selected**.
3. **Delete all for this site** asks for explicit confirmation first.
4. Session vs persistent cookies and flags (Secure, HttpOnly, SameSite, expiry)
   are shown per cookie so you can decide what to remove.

Everything is 100% local — no network calls, no analytics, no remote code.

## Files

- `manifest.json` — Manifest V3, permissions: `cookies`, `tabs`, `storage`
  (host permissions exist only so cookie details can be read/deleted).
- `popup.html` / `popup.css` / `popup.js` — the cookie list UI and logic.
- `icons/` — 16/48/128 PNG icons generated with PIL.
