# My Library Log

Your personal reading library tracker — books, reading status, progress, and notes.

## What it does

- **Add books**: title, author, status (Want to read / Reading / Finished), reading progress %, notes.
- **Search**: case-insensitive search across title, author, and notes.
- **Status counts**: header strip shows counts per status.
- **Export / Import**: JSON export and import (500-book cap, entries validated).
- **Delete** per book. All data in `chrome.storage.local`.

## What it does NOT do

**It is not connected to any Calibre server and fetches no metadata.** Every book is
entered by you manually; there is no automatic lookup, cover art, or library sync.

## Privacy

Everything runs locally. No network requests.
