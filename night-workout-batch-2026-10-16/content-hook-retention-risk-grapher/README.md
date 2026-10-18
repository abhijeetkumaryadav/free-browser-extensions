# Retention Risk Grapher — Content Hook Analyzer

Scores each sentence of a pasted script for **retention risk (0–100)** and draws
a **risk-over-time line chart**, plus a list of the riskiest sentences.

## Honest scope

- **Heuristic proxy — not real retention data, not AI.** Scores come from
  simple proxies:
  - **+risk:** long sentences (>20/+15, >28/+30 words), jargon hits from a
    bundled list (+12 each, capped at +36).
  - **−risk:** questions (−15), concrete numbers (−10), direct address
    ("you/your", −5).
- Nothing is measured about viewers; nothing is sent anywhere. Scoring runs
  locally in the popup; the last pasted script is cached in
  `chrome.storage.local` only for convenience.

## Usage

1. Click the extension icon.
2. Paste your script.
3. Click **Score retention risk** to see the average score, verdict band,
   the per-sentence chart, and the top risky sentences with their reasons.
4. **Clear** wipes the text and the cached copy.

## Permissions

- `storage` — cache the last pasted script locally.

## Files

- `manifest.json` — Manifest V3 config
- `popup.html` / `popup.css` / `popup.js` — UI + heuristic engine
  (engine lives between `// ENGINE-START` and `// ENGINE-END`)
- `icons/` — generated PNG icons (16/48/128)
