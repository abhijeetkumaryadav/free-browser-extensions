# Landing Page Copywriting Hook Analyzer

Runs a **heuristic copywriting checklist** against any landing page: hero value
proposition, CTA presence, specificity/numbers, social-proof signals, jargon, and
word balance — each with a plain-language tip.

## How it works

1. Click **“Analyze this page”** — a read-only extractor (via `chrome.scripting`,
   `activeTab`, explicit click only) grabs the h1, lead paragraph, headings,
   CTA-style buttons, and visible body text.
2. The bundled, dependency-free checklist scores each area as
   **GOOD / OK / WEAK** and explains what to look at.
3. A “copy health” score (0–100) averages the checks as a rough guide.

## Honest limitations

- **Heuristics, not measurements.** These checks cannot tell you what converts —
  only A/B tests with real visitors can.
- Pattern matching misses context: a page can fail every check and still convert,
  or pass every check and still flop.
- Copy behind logins, paywalls, or heavy JS may extract partially.

## Privacy

- 100% local. No network requests, no analytics.
- Read-only — the page is never modified.

## Files

| File | Purpose |
|---|---|
| `manifest.json` | MV3 manifest (`activeTab` + `scripting`) |
| `popup.html` / `popup.css` / `popup.js` | Popup UI, page extractor, checklist |
| `icons/` | Generated 16/48/128 PNG icons |
