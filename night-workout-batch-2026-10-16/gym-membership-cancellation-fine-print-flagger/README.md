# Fine-Print Flagger — Gym Contract Scanner

Scans gym membership contract text for common red-flag clauses using **bundled heuristic patterns** — cancellation fees, notice periods, auto-renewal, minimum commitments, and more.

## How it works

1. Paste contract text, or focus a text field / select text on a page and click **Scan focused field**.
2. The engine matches 12 bundled patterns and shows each hit with:
   - Severity (HIGH / MED / LOW)
   - The matched phrase plus surrounding context
   - A plain-language explanation of why the clause matters

## Honest scope

- **Heuristic pattern matching — not legal advice.** Patterns may miss novel wording or flag benign text. Always read the full contract yourself and consult a professional for binding decisions.
- The page is never modified; the scan grabber is read-only and injected on click only.
- 100% local. Zero network. Nothing is stored except your last pasted text.

## Files

- `manifest.json` — MV3 manifest (permissions: `storage`, `activeTab`, `scripting`)
- `popup.html` / `popup.css` / `popup.js` — popup UI
- `rules.js` — bundled rule engine (`scanFinePrint`), testable headlessly
- `content.js` — click-only read-only text grabber

## Testing

Headless engine tests: `node /tmp/fpf_test.js` (7/7 pass) — cancellation fee, auto-renewal, notice period, clean text, restrictive-cancel-channel, multiple severities, dedupe.
