# Ghost Town Forums — Your Forum Log

**Manual log only. No live scraping.** Save the forums you follow, record your last-visit notes, flag quiet ones, and open archive.org snapshots. Everything stays local in `chrome.storage.local`.

## Features

- Add forums: name, URL, last-visited date, notes, quiet flag
- Days-since-last-visit labels computed locally from the date you entered
- Per-forum **Archive.org ↗** link — opens a web.archive.org snapshot search in a new tab (the extension itself makes zero network calls)
- Case-insensitive search across name, URL, notes
- Per-forum delete, clear-all with confirm, JSON export/import

## Honest limits

- This tool does not visit forums, scrape posts, or check anything live.
- "Quiet" is your own flag; days-since labels come from the date *you* recorded.

## Privacy

- Permission `storage` only. No network. No telemetry.

## Install (developer mode)

1. Open `chrome://extensions`, enable Developer mode.
2. "Load unpacked" → select this folder.
3. Pin "Ghost Town Forums" and start logging.
