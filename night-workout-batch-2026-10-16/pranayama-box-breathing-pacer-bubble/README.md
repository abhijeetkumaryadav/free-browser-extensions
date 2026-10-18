# Pranayama Box Breathing Pacer Bubble

An animated breathing pacer: a bubble expands on inhale, holds, contracts on
exhale, holds — with per-second countdowns, an optional gentle chime on each
phase change, and a configurable session timer (1–30 min).

**Scope (honest):** pacing aid only — **not medical advice**. It does not
measure, diagnose, or treat anything. Breathe comfortably and stop if dizzy.

## Features

- Inhale / hold / exhale / hold counts, each 0–12 s (inhale/exhale min 2 s)
- Animated bubble synced to phase durations (CSS transition driven by JS)
- Gentle Web Audio chime on phase change (generated tone, no files)
- Session timer with auto-complete chime
- Settings persist locally (`chrome.storage.local`)
- Fully local: zero network, no analytics, `storage` permission only

## Permissions

- `storage` — remembers your phase counts and session length

## Files

- `manifest.json` — Manifest V3
- `popup.html` / `popup.css` / `popup.js` — pacer UI + phase engine
- `icons/` — generated PNG icons

## Load it

1. Open `chrome://extensions`, enable Developer mode
2. "Load unpacked" → select this folder
3. Click Start and follow the bubble
