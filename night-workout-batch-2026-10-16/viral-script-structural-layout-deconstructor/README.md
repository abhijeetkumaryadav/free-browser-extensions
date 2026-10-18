# Script Deconstructor — Viral Layout Analyzer

Heuristically segments a pasted video script into **Hook / Setup / Payoff / CTA**
and shows each section's word count and share of the script.

## Honest scope

- **Rule-based heuristics only — not AI.** Section boundaries come from bundled
  phrase lists and simple positional conventions:
  - **CTA** — trailing paragraphs containing call-to-action phrases
    ("subscribe", "link in bio", "comment below", …).
  - **Hook** — the first line(s) by convention; classified as a *question*,
    *statement*, or *unknown* hook.
  - **Payoff** — paragraphs containing payoff markers
    ("here's what happened", "the result", "finally", …).
  - **Setup** — everything else.
- The runtime estimate assumes ~150 words/minute.
- Nothing is sent anywhere: analysis runs locally in the popup; the last pasted
  script is cached in `chrome.storage.local` only for convenience.

## Usage

1. Click the extension icon.
2. Paste your script (one beat per line works best).
3. Click **Analyze structure** to see sections, word counts, proportions,
   hook type, and the estimated runtime.
4. **Clear** wipes the text and the cached copy.

## Permissions

- `storage` — cache the last pasted script locally.

## Files

- `manifest.json` — Manifest V3 config
- `popup.html` / `popup.css` / `popup.js` — UI + heuristic engine
  (engine lives between `// ENGINE-START` and `// ENGINE-END`)
- `icons/` — generated PNG icons (16/48/128)
