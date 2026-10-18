# Bot Swarm Signals — Heuristic Bot-Pattern Scanner

**Honest scope: heuristic signals only — NOT bot detection.** This extension flags surface patterns commonly associated with bot or spam comments (repetitive phrasing, generic praise, emoji overload, link spam, short content-free replies, ALL-CAPS, spam CTAs, hashtag stuffing). Patterns can and do misfire on real humans. Real moderation needs human review.

## What it does

- **Heuristic scanner** — paste a comment, get a 0–100 signal score, a verdict bucket (Clean / Mild / Strong / Very bot-like), and a per-signal breakdown.
- **Bot patterns guide** — plain-language explainer of the five patterns to know: repetitive phrasing, generic praise, emoji/link overload, short content-free comments, timing clusters.
- **My notes** — your own notes, autosaved locally.

## Privacy

Fully local. Nothing leaves the browser. Permission: `storage` only.

## Files

`manifest.json`, `popup.html`, `popup.css`, `popup.js` (pure engine between `// ENGINE-START` / `// ENGINE-END`), `README.md`, icons (16/48/128 PNG).

## Validation

`node --check` on popup.js, manifest.json parses (MV3), icons exact 16/48/128, manifest.json at ZIP root, headless engine tests (clean text → 0, generic praise → score, emoji overload, link spam, empty input, verdict buckets, score cap).
