# Linkrot Estimator — Decay Risk Signals

**Heuristic signals only — not live link checking.** Save links with a last-known-good date and get a 0–100 decay-risk score from simple, explainable signals. Nothing is fetched, opened, or verified.

## Features

- Add links: title, URL, last-known-good date, notes
- 0–100 score ring + verdict (Low / Moderate / High / Very high risk signals)
- Signal guide tab explaining what each metric counts
- Case-insensitive search, per-link delete, clear-all, JSON export/import

## What the score counts

1. **Age** — ~12 points per year since the last-known-good date you entered, capped at 60.
2. **Deep path** — 4+ path segments +15; 2–3 segments +8.
3. **Host type** — free/personal hosts (blogspot, github.io, etc.) +10.
4. **Unknown history** — no date entered counts as +15 (mildly risky).

## Honest limits

- Scores are heuristics from data *you* entered. A high score does not mean the link is dead; a low score does not mean it is alive.
- This tool performs no network requests of any kind.

## Privacy

- Permission `storage` only. No network. No telemetry.

## Install (developer mode)

1. Open `chrome://extensions`, enable Developer mode.
2. "Load unpacked" → select this folder.
