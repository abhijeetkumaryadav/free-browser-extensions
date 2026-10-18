# Snapshot Time Traveler — Page Log & Wayback Links

## What it is (honest scope)
Your own page-snapshot log: save pages you want to time-travel later, each with
Wayback Machine links (snapshot list + latest snapshot) that open in a new tab.
It teaches you to track pages worth revisiting; it performs no fetching itself.

## What it does NOT do
- It does **not** fetch or archive anything — the extension makes **zero network calls**.
- "Your log — not live snapshots" is stated prominently in the popup.
- Wayback links are plain anchors: *you* open them in a tab, the tool just formats them.

## Features
- Log entries: URL (http/https validated), title, your notes.
- Per-entry Wayback links: "Wayback list" (all snapshots) and "Latest" (newest snapshot).
- Case-insensitive search, newest-first, per-entry delete, clear-all with confirm.
- Stored only in `chrome.storage.local`. 500-entry cap.

## Privacy
Fully local. No analytics, no network, no data leaves your browser.

## Test
Headless engine tests: 12/12 pass (URL validation/scheme guards, entry validation,
newest-first immutable sort, case-insensitive filter, Wayback URL formats).
