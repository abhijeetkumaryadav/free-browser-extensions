# Bubble Latency Tracker v1.0.0

Manual stopwatch log for Bubble plugin and workflow-step timings. Add the
plugins / workflow steps you care about, start the timer while you test in
Bubble, stop it, and the extension aggregates averages, slowest steps, totals,
and exports a CSV.

## Honest scope
Browser extensions cannot instrument Bubble apps, so nothing is measured
automatically. This is a manual timing companion: you run the stopwatch, it
does the bookkeeping. This is stated in the popup footer and the store
description.

## Features
- Named plugin / workflow-step list with per-item run counts
- Live stopwatch (timestamp-based — keeps counting while the popup is closed)
- Optional note per run, recent-runs log (last 30)
- Per-plugin stats: runs, average, slowest, total — sorted slowest-first
- CSV export for analysis; two-step clear-all

## Install
**Chrome / Edge:** unzip → `chrome://extensions` → Developer mode → Load unpacked → select the folder.
**Firefox:** `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → select `manifest.json`.

## Permissions (justified)
- `storage` — plugins, runs, and active timer state, on-device only.
- `clipboardWrite` — reserved for future copy actions (currently unused by UI; declared for the export flow).

No host permissions, no network calls, no remote code. Everything stays on-device.

## Publishing notes
MV3, no deprecated APIs. No data collected, no page access — the privacy
questionnaire is trivial. The description must keep the "manual tracker"
honesty to avoid misleading capability claims.
