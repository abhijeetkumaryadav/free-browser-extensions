# Similarity Scanner — Text Overlap Comparer

**Paste two texts and compare their surface similarity.** Computes trigram
overlap, finds the longest shared word runs, and shows an overall similarity
percentage with per-text highlights.

## What it does

- **Trigram overlap:** share of 3-word n-grams common to both texts
  (relative to the smaller text), expressed as a 0–100% similarity score
- **Longest match:** longest shared word run, with matched passages
  highlighted in each text
- **Session memory:** your last pasted texts are restored on reopen

## Honest scope

- **Surface similarity only — not plagiarism verdicts.** It counts shared
  words; it cannot judge intent, sourcing, paraphrase, or originality.
- Common phrases ("for example", "in conclusion") raise the score without
  meaning anything was copied.
- Fully local: no network, no servers, nothing uploaded.

## Technical

- Manifest V3, permission: `storage` only (session restore)
- Pure-JS engine: tokenize → trigram sets → longest-common-substring DP
- 360–400px deep-dark glassmorphism popup, single amber accent, Lucide-style
  outline icons
- Headless engine tests: 22/22 pass
