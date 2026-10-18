# Syllabus Deadline Extractor

Paste your course syllabus text. The extension heuristically extracts dates
(like "Oct 20", "10/20", or "2026-10-20") with their descriptions, lets you
edit or remove each one, and exports an **.ics file** you import into your own
calendar — plus a plain-text copy option.

## Honest scope

- Date extraction is **heuristic**. Ambiguous formats (e.g. 10/11) are assumed
  MM/DD, and dates in the past may roll to next year. **Verify every date.**
- Nothing is added to your calendar automatically. You download the .ics and
  import it yourself.

## Permissions

- `storage` — remembers your last course name. No network, no tracking.

## Files

- `manifest.json` — Manifest V3
- `popup.html` / `popup.css` / `popup.js` — UI, extraction logic, ICS builder
- `icons/` — generated PNG icons (16/48/128)
