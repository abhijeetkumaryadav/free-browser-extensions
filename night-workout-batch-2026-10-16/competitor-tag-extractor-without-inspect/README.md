# Meta Tag Extractor — On-Click Page Reader

**Reads only the tab you click from. Changes nothing on the page.**

Click "Read this page's tags" and see the current tab's `<title>`, all
`<meta>` tags (name / property / http-equiv / charset), and the canonical
link — as a clean list you can copy.

## What it does

- **Read this page's tags** — one click injects a read-only scan into the
  active tab (via `activeTab` + `scripting`). No page content is modified,
  so the read is reversible by nature.
- **Extracted list** — deduped, capped, and sanitized through the engine's
  `collectMeta` function. Copy everything with one click.
- **Save snapshot** — store a page's tag summary (URL, title, tag count,
  your note) for later; view and delete snapshots anytime.
- Works on `http(s)` pages only. Nothing is sent anywhere; everything stays
  in `chrome.storage.local`.

## Files

- `manifest.json` — Manifest V3 (`activeTab`, `scripting`, `storage`)
- `popup.html` / `popup.css` / `popup.js`
- `icons/icon{16,48,128}.png`
- Engine functions (between `ENGINE-START` / `ENGINE-END` in `popup.js`) are
  headless-testable in Node.

## Validation

- `node --check popup.js` ✅
- `manifest.json` parses, Manifest V3 ✅
- Icons exact 16/48/128 ✅
- `manifest.json` at ZIP root ✅
- Headless engine tests: **13/13 pass** (title, canonical, dedupe,
  property/charset/http-equiv tags, empty-skip, bad-doc safety,
  text formatting, snapshot create/reject/caps)
