# Deep Diaphragmatic Breath Metronome

A pacing aid for slow diaphragmatic breathing. Steady generated ticking at a
configurable breaths-per-minute, with inhale/exhale phase display and a
session timer. Everything runs locally — no network, no accounts.

## Honest scope

- **Pacing aid only — not medical advice.** Breathe comfortably; stop if you
  feel dizzy or uncomfortable.
- Ticks are generated tones (Web Audio), not recorded audio.
- Timer counts are estimates; the extension cannot measure your actual breath.

## Use

1. Set **breaths per minute** (3–20), **session length** (1–30 min) and
   **inhale share** (20–80% of each cycle).
2. Optionally enable **tick on each phase change** (default on).
3. Press **Start**. The ball expands on inhale and contracts on exhale with a
   per-second countdown; the session timer and breath counter run below.
4. **Stop** ends the session early; settings persist between sessions.

## Files

- `manifest.json` — MV3 manifest (`storage` permission only)
- `popup.html` / `popup.css` / `popup.js` — UI and timing engine
  (`planBreath` / `fmtTime` between `ENGINE-START` / `ENGINE-END` markers are
  pure and headless-testable)
- `icons/` — generated 16/48/128 PNG icons
