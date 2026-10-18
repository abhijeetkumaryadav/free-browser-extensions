# Fallacy Signal Scanner — Heuristic Fallacy Checker

Paste text and scan it for heuristic fallacy signals: ad hominem, strawman, appeal to authority, slippery slope, false dilemma, hasty generalization, circular reasoning, appeal to emotion, bandwagon, and red herring.

**Heuristic signals only — NOT real fallacy detection.** The extension matches hand-written regex patterns against your text. Patterns can misfire (false positives) and will miss genuinely fallacious arguments written cleverly. It does not understand meaning, context, or truth. Use your own judgment.

## How it works
- Paste an argument, comment, or article excerpt and click **Scan for signals**.
- A 0–100 score ring summarizes how many signal patterns fired, with a verdict bucket (Clean / Mild / Somewhat / Very fallacious).
- Each flagged category shows a plain-language explanation of the fallacy and the matching snippets from your text.
- Your last pasted text is remembered locally for convenience.

## Privacy
- Fully local. Nothing is uploaded, analyzed remotely, or transmitted anywhere. Zero network calls.

## Permissions
- `storage` — remembers your last pasted text.

## Files
- `manifest.json` — MV3 manifest
- `popup.html` / `popup.css` / `popup.js` — UI + scan engine (`scanText`, `verdictFor`, `snippet` between `// ENGINE-START` / `// ENGINE-END`)
- `icons/` — 16/48/128 PNG icons

## Install (developer mode)
1. Open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
2. **Load unpacked** → select this folder.
3. Click the toolbar icon and paste text.

Works in Chrome, Edge, Firefox, and Opera (MV3).
