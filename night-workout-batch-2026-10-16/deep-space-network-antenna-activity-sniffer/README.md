# DSN Dashboard — Deep Space Network Edu

**Educational only — not live DSN data.** This extension has no data feed.
Antenna facts are static reference info, and contact times are entered by
you — nothing is pulled from any live source.

## What it does

- **Antenna facts** — quick reference: the 70 m giant dishes (DSS-14, DSS-43,
  DSS-63), the 34 m beam-waveguide dishes, and why the three complexes sit
  ~120° apart around the globe (Goldstone CA, Madrid Spain, Canberra
  Australia).
- **Next contact countdown** — live 1-second countdown to your next
  manually-scheduled contact (`2d 04:13:05` format).
- **Contact schedule** — add spacecraft + date/time + note, sorted
  soonest-first, per-entry delete, clear-all. Past entries dim.
- **Headless-testable engine** — validation, sorting, next-contact
  selection and countdown math are pure functions between
  `// ENGINE-START` / `// ENGINE-END`.

## Honest scope

- No network requests, no live data, no notifications.
- All contacts live in `chrome.storage.local` (capped at 50).

## Permissions

- `storage` — save your contact schedule.

## Privacy

Everything stays in your browser. Nothing is uploaded or transmitted.
