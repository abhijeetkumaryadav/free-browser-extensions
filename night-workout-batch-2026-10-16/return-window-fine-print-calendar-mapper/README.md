# Return Window Mapper

**v1.0.0** · Manifest V3 · Chrome / Edge (works in any Chromium-based browser).

## What it does
Log purchases with their purchase date and return-window length, and see a live
dashboard of return deadlines: per-purchase countdowns, an urgent/expiring-this-week
alert banner, stats, fine-print notes per purchase, and mark-resolved / remove actions.
Deadlines auto-sort soonest-first.

## Honest scope (important)
- Deadlines are computed from **policies you enter**. Sellers change terms; this is a
  reminder aid, not legal proof of any return right. Always verify with the seller's
  actual terms before a return.
- Everything stays in `chrome.storage.local`. Nothing is transmitted anywhere.

## Files
- `manifest.json` — MV3 manifest, `storage` permission only
- `popup.html` / `popup.css` / `popup.js` — glassmorphism UI + deadline logic
- `icons/` — PIL-generated 16/48/128 PNG icons
- `README.md`

## Permissions justification
- `storage` — persists your logged purchases locally. Nothing else is needed.

## Validation
- `manifest.json` parses, MV3
- `node --check` passes on `popup.js`
- Icons 16/48/128 generated
- `<slug>.zip` has `manifest.json` at zip root

Not tested in a live browser (validation covered manifest/JS/icons/packaging per the
marathon convention). Development build — no store submission.
