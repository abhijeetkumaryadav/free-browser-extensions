# Zen Workspace — Distraction-Free New Tab

A serene new-tab workspace: a minimal clock with greeting, a single focus task, a guided breathing-exercise widget, and a clean notes scratchpad. Everything persists locally. No feeds, no trackers, no network calls.

## Features

- **Minimal clock** — large time display, date line, and a time-of-day greeting.
- **One focus** — a single focus-task input with a completion toggle. One thing at a time.
- **Breathe** — guided breathing with an animated orb and phase labels; configurable inhale / hold / exhale durations (2–10s).
- **Scratchpad** — autosaving notes with a live word count and a confirm-before-clear button.

## Install

1. Open `chrome://extensions`, enable **Developer mode**.
2. Click **Load unpacked** and select this folder. New tabs will open Zen Workspace.

## Permissions

- `storage` — persist the focus task, notes, and breathing settings locally. Nothing else.

## Honest scope

- 100% local. No network requests, no analytics, no accounts, no data leaves the device.
- The breathing widget is a relaxation aid, not a medical device.

## Files

- `manifest.json` — MV3 manifest with `chrome_url_overrides` for the new tab
- `newtab.html` / `newtab.css` / `newtab.js` — the workspace page
- `icons/` — 16/48/128 PNG icons
