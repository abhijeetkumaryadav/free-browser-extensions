# RPG Gym Logger — Gamified Workout Logbook

Turn workouts into an RPG:

- **Log sets** (exercise, weight, reps) and assign each to **STR / END / AGI**
- **Earn XP** per set — XP = 10 + ⌊reps/2⌋ + ⌊weight/10⌋, level thresholds grow quadratically
- **Character card** with level, XP bar, and STR/END/AGI stats that grow as you log
- **8 achievement badges**: First Set, 10/50/100 Sets, Level 3/5, Balanced, 10t Volume
- History with per-set delete, clear-all with confirm — all in `chrome.storage.local`

## Honest scope

Gamified logbook — not coaching advice. It counts what you log; it recommends nothing.

## Files

- `manifest.json` — MV3, `storage` only
- `popup.html` / `popup.css` / `popup.js` — UI + XP/level/badge engine
- `icons/` — generated 16/48/128 PNG icons

Install via `chrome://extensions` → Developer mode → Load unpacked.
