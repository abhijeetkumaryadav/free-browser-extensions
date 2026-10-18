# Conjugation Drill — Instant Verb Tables

Build your own verb conjugation tables and drill them with instant scoring. 100% local — nothing leaves your browser.

## What it does
- **Tables tab:** create verb tables — enter an infinitive plus one conjugated form per line. Save, delete, and reuse them.
- **Drill tab:** pick a table and a question count; each question asks for a random form by number ("hablar — form 3 of 6"). Type the answer and get instant ✓/✗ scoring, then a percentage result with study advice.

## Honest scope
**Your tables — not a grammar engine.** The extension does not know any grammar; it drills exactly the forms *you* entered. A "correct" answer just means it matches your saved form.

## Privacy
- Data lives in `chrome.storage.local` only. Zero network requests.

## Files
- `manifest.json` — Manifest V3
- `popup.html` / `popup.css` / `popup.js` — UI + drill engine (pure helpers marked `// ENGINE-START` … `// ENGINE-END`)
- `icons/` — 16/48/128 PNG icons
