# Label Lens — Supplement Ingredient Scanner

Scans supplement label text for transparency and additive markers using **bundled heuristic lists** — proprietary blends, artificial colors/sweeteners, common fillers, and label-transparency checks.

## How it works

1. Paste the supplement facts / ingredients text, or focus a text field / select text on a page and click **Scan focused field**.
2. The engine matches 10 bundled rules and shows each hit with:
   - Severity (HIGH / MED / LOW)
   - The matched phrase plus surrounding context
   - A plain-language explanation of what it means
3. Extracted serving-size / servings-per-container stats are shown when present.

## Honest scope

- **Label heuristics only — NOT purity testing, NOT medical advice.** This tool cannot detect contamination, potency, heavy metals, or whether a product is safe or effective. It flags label patterns only.
- The page is never modified; the scan grabber is read-only and injected on click only.
- 100% local. Zero network. Nothing is stored except your last pasted text.

## Files

- `manifest.json` — MV3 manifest (permissions: `storage`, `activeTab`, `scripting`)
- `popup.html` / `popup.css` / `popup.js` — popup UI
- `rules.js` — bundled rule engine (`scanLabel`), testable headlessly
- `content.js` — click-only read-only text grabber

## Testing

Headless engine tests: `node /tmp/ll_test.js` (10/10 pass) — proprietary blend, artificial colors, missing servings-per-container, clean label, marketing claim, filler flag, stats extraction.
