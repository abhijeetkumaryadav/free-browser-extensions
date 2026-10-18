# Citation Quality Checklist — Source Rater v1.0.0

Paste a citation and rate it against a heuristic quality checklist:
identifiable author, date, reputable venue, references, method/evidence,
conflict disclosure, and corrections policy. Weighted 0–100 score, verdict
bucket, your notes, and a saved local log of rated citations.

## Honest scope
- Your checklist only — **not real impact factors**, no journal metrics,
  no live data. It only scores the checks *you* tick.
- You make the final judgment; the score is a rough heuristic.

## Privacy
Everything stays in `chrome.storage.local`. Zero network calls.

## Files
- `manifest.json` — MV3, `storage` permission only
- `popup.html` / `popup.css` / `popup.js` — UI + engine
- `icons/` — 16/48/128 PNG
