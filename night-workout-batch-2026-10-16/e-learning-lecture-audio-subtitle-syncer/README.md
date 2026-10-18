# Lecture Note Timestamps

Manual timestamped lecture-notes logbook for the Chrome extension marathon.

## Honest scope

**This is a manual timestamp logbook. It does NOT sync from audio and uses no AI.**
You start a stopwatch session, press **Add @ now** whenever something matters,
and each note is stamped with the elapsed session time. Nothing listens to your
lecture — there is no audio access, no speech recognition, no subtitle engine.

## Features

- **Session stopwatch** — name a session, start, live MM:SS:HH clock
- **One-click timestamped notes** — type a note, hit Add @ now (or Enter)
- **Quick tags** — Key concept / Exam likely / Confusing / Example chips
- **Timeline view** — notes in order with copyable timestamps, per-note delete
- **Past sessions** — archived on stop (30 max), view or delete
- **Export Markdown** — `# Session` + `- **MM:SS** — note` list
- **Copy all** — Markdown to clipboard
- All data in `chrome.storage.local`, 100% local, zero network

## Permissions

- `storage` only — session archive.

## Files

`manifest.json`, `popup.html`, `popup.css`, `popup.js`, `README.md`, `icons/`.
