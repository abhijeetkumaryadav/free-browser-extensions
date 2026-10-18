# My Spam Flags — Personal Search Spam Blocker

**Honest scope:** there is **no crowd and no server** here — a shared spam-flag
network would need accounts, moderation, and a backend. This extension keeps a
**personal** list of domains **you** flag as spam. On your click it dims (or
collapses) search-result cards linking to those domains, and **Restore** returns
the page exactly. Nothing is ever shared.

## How it works

1. Type a domain (e.g. `spammy-deals.example`) and click **Add**. Entries are
   normalized (scheme/www stripped, lowercased) and stored in
   `chrome.storage.local`.
2. Choose **Dim** or **Collapse**.
3. Click **Filter this page** — a click-only content script scans likely result
   cards (Google/Bing/DuckDuckGo layouts plus a generic fallback), unwraps
   common tracker redirects, and matches link hosts against your list
   (exact or subdomain).
4. **Restore** puts every touched card back exactly (original inline styles and
   title attributes are stashed first).
5. **Export list** downloads your flags as JSON; **Import list** loads an
   exported file back (invalid entries are skipped).

## Permissions

- `storage` — your flagged domains and mode, local only.
- `activeTab` + `scripting` — inject the page engine **only on your explicit
  click**, only on the active tab. No background running, no network calls.

## Files

`manifest.json`, `popup.html`, `popup.css`, `popup.js`, `content.js`, `README.md`, `icons/`.

Built for the extension marathon. Manifest V3. Not tested in a live browser —
validation covered manifest parsing, JS syntax, icon sizes, and ZIP structure.
