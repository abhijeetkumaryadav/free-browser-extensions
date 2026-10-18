# Context Chunker — Prompt Text Splitter

**Honest scope:** Prepares long text for AI prompts. This is **not** an AI tool —
it contains no models and makes no network calls. Token counts are
4-characters-per-token heuristic estimates, not real tokenizer counts.

## What it does

- Pastes long text and splits it into chunks of a configurable size
  (200–8,000 chars) with a configurable overlap (0–2,000 chars)
- Prefers to split on word boundaries (optional mid-word splitting)
- Shows per-chunk character counts and ≈ token estimates
- One-click **Copy chunk** per chunk; total chunk + token summary
- Settings (size, overlap, mid-word toggle) persist locally

## Files

- `manifest.json` — Manifest V3, `storage` permission only
- `popup.html` / `popup.css` / `popup.js` — chunker UI
  (engine functions `chunkText` / `estimateTokens` sit between
  `// ENGINE-START` and `// ENGINE-END` markers for testability)
- `icons/` — generated 16/48/128 PNG icons
- `README.md` — this file

## Permissions

- `storage` — persist chunker settings only. Nothing leaves your machine.
