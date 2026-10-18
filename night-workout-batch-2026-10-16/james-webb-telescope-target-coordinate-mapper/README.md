# JWST Target List — Deep-Sky Coordinate Logbook

A personal browser-extension logbook for deep-sky observing targets, with
right-ascension/declination coordinates and notes.

## What it does

- Add targets with a name, **RA (hours, 0–24)** and **Dec (degrees, −90–+90)**, plus free notes.
- Coordinates are formatted on display as `05h 35m 17s` / `−05° 23′ 28″`.
- Search across names and notes (case-insensitive).
- Delete individual targets. Everything persists in `chrome.storage.local`.

## Honest scope

**Your list — not live telescope data.** This is an educational personal
logbook: it stores targets *you* enter. It has no connection to JWST or any
live telescope feed, and performs no real astronomical computation beyond
sexagesimal formatting.

## Privacy

Fully local. Zero network requests, no analytics, no accounts.

## Install (developer mode)

1. Open `chrome://extensions`, enable Developer mode.
2. "Load unpacked" → select this folder.
3. Click the extension icon to open the logbook.
