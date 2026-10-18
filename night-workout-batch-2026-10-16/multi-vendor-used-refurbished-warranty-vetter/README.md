# Warranty Vetter — Used & Refurbished

**v1.0.0** · Manifest V3 · Chrome / Edge (works in any Chromium-based browser; Firefox-compatible code style).

## What it does
Type in the warranty terms offered by different sellers of a used or refurbished item
(warranty months, money-back days, coverage checkboxes, who pays return shipping,
restocking fee, your own notes) and get a transparent 0–100 score per seller plus a
ranked comparison table with an expandable score breakdown.

## Honest scope (important)
- Scores are computed **from the terms YOU type in**. The extension cannot verify
  that a seller will honor those terms — always read the actual policy.
- It is a comparison aid, not a guarantee of anything. Nothing is transmitted
  anywhere; everything stays in `chrome.storage.local`.

## Scoring checklist (max 100)
| Factor | Points |
|---|---|
| Warranty duration (12+ mo / 6–11 / 3–5 / 1–2 / 0) | 40 / 25 / 12 / 6 / 0 |
| Coverage: parts&labor, battery, accidental, certified | 5 each (max 20) |
| Return shipping paid by seller / unknown / buyer | 10 / 4 / 0 |
| Restocking fee: none / unknown / yes | 10 / 4 / 0 |
| Money-back window (14+ d / 7–13 / 1–6 / 0) | 20 / 12 / 6 / 0 |

## Files
- `manifest.json` — MV3 manifest, `storage` permission only
- `popup.html` / `popup.css` / `popup.js` — glassmorphism UI + scoring logic
- `icons/` — PIL-generated 16/48/128 PNG icons
- `README.md`

## Permissions justification
- `storage` — persists your entered warranty terms locally. Nothing else is needed.

## Validation
- `manifest.json` parses, MV3
- `node --check` passes on `popup.js`
- Icons 16/48/128 generated
- `<slug>.zip` has `manifest.json` at zip root

Not tested in a live browser (validation covered manifest/JS/icons/packaging per the
marathon convention). Development build — no store submission.
