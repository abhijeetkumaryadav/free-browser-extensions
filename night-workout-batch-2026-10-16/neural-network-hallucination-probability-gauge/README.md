# Hallucination Risk Gauge — AI Text Signal Scanner

**Honest scope: heuristic signals only — NOT a real hallucination probability.** This extension flags surface patterns that correlate with ungrounded AI text (hedge words, citation-shaped phrases that may be fabricated, overconfident absolutes, unsourced precision, vague attributions). It cannot measure whether a claim is true. Always verify against primary sources.

## What it does

- **Heuristic scanner** — paste AI-generated text, get a 0–100 risk-signal score on an animated gauge, a verdict bucket (Low / Moderate / High / Very high risk signals), and a per-signal breakdown with what to verify.
- **Signal guide** — plain-language explainer of the four signals that raise risk.
- **My verification notes** — record what you actually verified, autosaved locally.

## Privacy

Fully local. Nothing leaves the browser. Permission: `storage` only.

## Files

`manifest.json`, `popup.html`, `popup.css`, `popup.js` (pure engine between `// ENGINE-START` / `// ENGINE-END`), `README.md`, icons (16/48/128 PNG).

## Validation

`node --check` on popup.js, manifest.json parses (MV3), icons exact 16/48/128, manifest.json at ZIP root, headless engine tests (hedge words, fabricated citation pattern, absolutes, unsourced precision, vague attribution, empty input, verdict buckets, score cap).
