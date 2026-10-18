# CEFR Text Rater — Complexity Levels

Heuristic text-complexity rater that maps pasted English text to **A1–C2** bands
from sentence length and word rarity (a bundled ~2,000-word common list; anything
outside counts as rare). Shows an overall score, averages, and a per-sentence
breakdown with individual band labels.

**Honest scope:** this is a heuristic proxy — **not a real CEFR assessment**,
not AI, and makes no grammar or meaning judgments. The popup and README say so.

## Details
- MV3, 380px deep-dark glassmorphism, one sky accent (#81baf0)
- Permission: `storage` only (remembers the last pasted text)
- Fully local, zero network

## Files
- `manifest.json`, `popup.html`, `popup.css`, `popup.js` (engine between `// ENGINE-START` / `// ENGINE-END`), `README.md`, `icons/icon{16,48,128}.png`
