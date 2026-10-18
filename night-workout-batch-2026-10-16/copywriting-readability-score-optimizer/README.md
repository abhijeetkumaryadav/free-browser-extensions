# Readability Scorer

**Formula-based score — not AI optimization.** Computes real Flesch Reading Ease and Flesch-Kincaid Grade Level with rule-based heuristics, plus actionable suggestions. 100% local.

## What it does

- Paste copy → **Score readability** computes:
  - **Flesch Reading Ease** (206.835 − 1.015·ASL − 84.6·ASW), with a plain-English verdict
  - **Flesch-Kincaid Grade Level**, the approximate US school grade needed
- Syllables counted by a vowel-group heuristic (documented limitation)
- **Heuristic suggestions**:
  - Flags sentences that are long (≥25 words) or heavy on 3+ syllable words
  - Bundled long→short word swaps (e.g. `utilize` → `use`, `in order to` → `to`) — you apply them
  - Per-sentence cards with word counts and "Hard / Watch / OK" badges

## Honest scope

- Real formulas, but syllable counts are estimates — scores are approximate
- Suggestions are heuristics; it never rewrites your copy
- No network calls; everything stays in your browser

## Files

- `manifest.json` — Manifest V3, `storage` permission only
- `popup.html` / `popup.css` / `popup.js` — UI, styles, readability engine
