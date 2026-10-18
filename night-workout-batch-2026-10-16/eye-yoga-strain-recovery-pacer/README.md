# Eye Yoga Pacer — Strain Recovery Routines

A guided eye-exercise pacing aid with animated canvas routines and a session log.

## What it does

Four timed phases, each 20–180 seconds (configurable) with adjustable dot speed (1–5):

- **Figure-8** — the dot traces a figure-8; follow it with your eyes, head still.
- **Up–Down** — vertical tracing path.
- **Left–Right** — horizontal tracing path.
- **Palming** — countdown screen; cover your eyes with warm palms and breathe slowly.

A faint guide path is always drawn so you can see the route. Each completed phase is logged (phase + seconds + timestamp); clear the log anytime.

## Honest scope

**Pacing aid only — not medical advice.** This extension guides eye movement with a visual dot; it does not diagnose, treat, or assess any eye condition. Stop if anything feels uncomfortable. See an eye-care professional for vision problems.

## Privacy

- 100% local. Permission: `storage` (settings, session log).
- No network, no analytics, no accounts.

## Files

- `manifest.json` — Manifest V3
- `popup.html` / `popup.css` / `popup.js` — 380px glassmorphism panel + canvas engine
- `icons/` — generated 16/48/128 PNG icons

## Install (developer mode)

1. Open `chrome://extensions`, enable Developer mode.
2. "Load unpacked" → select this folder. Or install the `.zip` via your browser's extension page.
