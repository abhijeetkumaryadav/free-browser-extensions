# TikTok Hook Analyzer

Scores the opening hook of a short-video script using rule-based heuristics.

## What it does

Paste a script (one beat per line) and press **Analyze hook**. The extension takes
the first non-empty line as the hook and scores it 0–100 across five factors:

| Factor | Weight | Rule |
|---|---|---|
| Opens with a question | 20 | Ends with `?`, or starts with who/what/why/how/did/do/can… |
| Contains a number | 15 | Any digit in the hook |
| Short hook | 25 | ≤12 words = full, 13–18 = half, >18 = none |
| Strong verb / power word | 20 | Hit against a bundled list (stop, secret, proven, warning…) |
| Speaks to the viewer | 20 | Contains you / your / you're… |

You get a per-factor breakdown, plain-language tips for every failed factor, and
script stats (word counts, line count, estimated spoken runtime at ~150 wpm).

## Honest scope

- **Heuristic scoring only — not AI.** The engine is pure rule matching; it
  cannot judge creativity, delivery, or what an audience will actually do.
- Only the **first non-empty line** is treated as the hook.
- Your last pasted script is cached locally so it survives popup close.
- 100% local. No network, no accounts, no analytics.

## Files

- `manifest.json` — Manifest V3, `storage` permission only
- `popup.html` / `popup.css` / `popup.js` — UI + scoring engine
- `icons/` — generated PNG icons (16/48/128)

## Permissions

- `storage` — cache the last pasted script locally.
