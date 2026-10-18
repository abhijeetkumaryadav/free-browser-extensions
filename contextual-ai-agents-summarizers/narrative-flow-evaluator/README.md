# Narrative Flow Evaluator v1.0.0

**Paste story or article text, get a pacing read.** Computes a
heuristic flow score (0–100) from four surface-rhythm signals:

- **Sentence variety** — coefficient of variation of sentence lengths
- **Dialogue balance** — share of text inside quotation marks
- **Paragraph variety** — variation in paragraph sizes
- **Pacing shape** — tension-word density across eighths of the text

Includes a sentence-rhythm bar visualization, a pacing-curve chart,
per-metric bars, and plain-language suggestions.

**Honest scope:** every score is a labeled heuristic computed
on-device from surface patterns — a writing aid, not a literary
judgment. Your text is saved only in the extension's local storage
so it survives popup closes; nothing is uploaded.

## Try it
1. Unzip `narrative-flow-evaluator.zip`.
2. `chrome://extensions` → Developer mode → **Load unpacked** → select the folder.
   (Edge: `edge://extensions`. Firefox: `about:debugging` → This Firefox → Load Temporary Add-on → pick `manifest.json`.)
3. Paste 500+ words → **Analyze flow**.

## Permissions
- `storage` — keep your pasted draft between popup sessions. No page access, no network.

## Publishing notes
- Chrome Web Store: $5 one-time developer registration, 2-step verification, MV3 listing with privacy disclosure (no data collected).
- Edge Add-ons: free account. Firefox Add-ons: free, requires signed build.
