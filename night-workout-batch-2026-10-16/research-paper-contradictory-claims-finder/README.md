# Claim Ledger — Research Claims Organizer

Honestly-narrowed build: there is no AI claim analysis here. This extension is a
**claims/evidence logbook** for researchers:

- Log a claim you read, with its source (paper, author, year) and that source's
  stance: **Supports / Contradicts / Neutral** toward your topic.
- Claims are **grouped by topic**, with stance counts per topic.
- The **Compare** tab shows claims on one topic side by side so **you** can spot
  contradictions yourself.

> Your organized notes only — the extension does **not** find contradictions
> automatically and cannot analyze papers.

## Features

- Add claims with topic, claim text, source, stance, and a personal note.
- Topic overview with supports/contradicts/neutral tallies.
- Side-by-side stance comparison per topic with color-coded cards.
- Topic autocomplete (datalist) from previously used topics.
- Per-claim delete. Everything persists in `chrome.storage.local` — 100% local,
  zero network.

## Scope limits

- No AI, no paper parsing, no contradiction detection. You read, you judge,
  the extension organizes.
- `storage` is the only permission.

## Privacy

All data stays in your browser. Nothing is sent anywhere.
