# Sentence Split Helper

**Flags only — you do the splitting.** A rule-based long-sentence flagger with manual splitting guidance. No AI anywhere, 100% local.

## What it does

- Paste text → **Scan sentences** splits it into sentences (abbreviation-aware)
- Sentences over your word-count threshold (default 25, adjustable 10–60) are flagged as **Split candidates**
- Each flagged sentence shows:
  - Word count and an estimated clause count (conjunctions + semicolons, heuristic)
  - **Split-point chips**: the conjunctions in the sentence — good places to break it
  - Practical guidance (split near a conjunction, keep one idea per sentence)
- Threshold preference persists between sessions

## Honest scope

- Heuristic, rule-based — clause counts are estimates, conjunctions are split *suggestions*
- Sentence splitting needs judgment; the extension never rewrites anything
- No network calls; everything stays in your browser

## Files

- `manifest.json` — Manifest V3, `storage` permission only
- `popup.html` / `popup.css` / `popup.js` — UI, styles, heuristic analysis engine
