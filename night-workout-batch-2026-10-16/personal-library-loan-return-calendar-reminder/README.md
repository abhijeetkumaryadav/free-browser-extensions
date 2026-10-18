# Loan Tracker — Book Loans & Due Dates (v1.0.0)

Your personal book-loan log. Record who borrowed which book, when it's due back,
and get overdue flags computed from plain date math.

## Honest scope

**Manual reminders only.** This extension sends no emails, push notifications, or
calendar events. The "reminder" is the overdue count you see when you open the
popup — checking it is on you. Everything is local, in `chrome.storage.local`.

## Features

- Record loans: book title, borrower, due date, note
- Overdue / due-today / due-soon / on-track flags from local date math
- Active vs returned tabs, per-loan return marking (reversible)
- Stat row: active, overdue, returned counts
- Case-insensitive search across book and borrower
- 500-loan cap to keep storage sane

## Permissions

- `storage` — store your loan records locally.

## Files

- `manifest.json` — MV3 manifest
- `popup.html` / `popup.css` / `popup.js` — popup UI; core engine between `// ENGINE-START` and `// ENGINE-END` in `popup.js`
- `icons/` — generated PNG icons (16/48/128)
