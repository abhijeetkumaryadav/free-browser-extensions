# Grade Weight Simulator (v1.0.0)

Weighted grade calculator with what-if scenarios and per-assignment impact charts.

## What it does

- **Assignments** — add/edit/delete assignments with name, weight %, and score %. Upcoming work can be marked "score not known" with an optional guess for projections.
- **Weighted grade** — computes your current grade over scored assignments, plus a projected final using your guesses for upcoming work. Includes a letter grade (A–F scale) and a weight-total check (warns if weights don't sum to 100%).
- **What-if calculator** — enter a target final %, and it tells you the average you need on the remaining (un-scored) weight to reach it. Plain arithmetic — not a guarantee.
- **Impact chart** — shows how many points each assignment contributes to your final grade.

## Honest scope

**Manual entry only — NOT connected to Canvas, Blackboard, or any LMS.** You type every assignment, weight, and score yourself. Nothing is scraped, synced, or auto-imported.

## Privacy

100% local. Data lives in `chrome.storage.local` on your machine. No network requests, no telemetry.

## Permissions

- `storage` — save your assignments on this device.

## Compatibility

Chrome / Edge / Firefox / Opera (Manifest V3).
