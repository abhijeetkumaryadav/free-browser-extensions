# AI Text Signals — Heuristic Pattern Scanner

Heuristic scanner for AI-typical writing patterns in pasted text (Manifest V3).

## What it does

- Paste any text (minimum 20 words for an honest score) → **0–100 score ring** with
  a verdict and a per-signal breakdown.
- Signals, all heuristic:
  - **Repetitive phrasing** — most common 3-word sentence opener repeats too often.
  - **Low burstiness** — sentence lengths are unusually uniform (coefficient of variation).
  - **Generic transitions** — filler scaffolding ("Furthermore", "In conclusion", "delve"…) per 100 words.
  - **Repetitive vocabulary** — low type-token ratio.
- Explainer card describing what each signal means and its limits.
- Last pasted text remembered locally (capped at 5,000 chars).

## Honest scope

**Heuristic signals — not real detection.** There is no AI model and no watermark
analysis here; these are writing-pattern heuristics. A high score does not prove AI
authorship, and a low score does not prove a human wrote the text. Patterns misfire —
use your own judgment.

## Privacy

- Fully local. Only your last pasted text (truncated) is stored in `chrome.storage.local`.
- Zero network calls.

## Permissions

- `storage` — remember the last pasted text.

## Files

- `manifest.json`, `popup.html`, `popup.css`, `popup.js`
- `icons/icon{16,48,128}.png` (PIL-generated document-scan glyph)
- `README.md`
