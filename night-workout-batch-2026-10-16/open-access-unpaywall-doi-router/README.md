# DOI Wishlist — Unpaywall & OpenAlex Links

Your personal DOI list. **Not live routing** — the extension makes zero
network calls. It stores your DOIs locally and gives you per-DOI links to
open Unpaywall and OpenAlex in a new tab for you to read yourself.

## Features

- Save DOIs with optional title and notes (real DOI syntax validation:
  `10.<registrant>/<suffix>`, accepts pasted `doi.org` URLs too)
- Per-entry **Unpaywall** and **OpenAlex** links (plain anchors — the
  extension itself never fetches anything)
- Case-insensitive search across DOI, title, and notes
- Newest-first, per-entry delete, clear-all with confirmation
- All data in `chrome.storage.local`

## Files

- `manifest.json` — Manifest V3, `storage` permission only
- `popup.html` / `popup.css` / `popup.js` — UI and engine
- `icons/` — generated PNG icons (16/48/128)

## Permissions

- `storage` — saves your DOI list locally. Nothing else.

## Honest limits

- No live availability data. Links open external search pages; you read
  the results yourself.
