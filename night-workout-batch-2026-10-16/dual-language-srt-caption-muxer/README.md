# Dual-Language SRT Muxer

Merge two SRT subtitle files (e.g. the original language + its translation) into one
dual-language SRT where every cue carries both texts.

**Scope (honest):** this merges subtitle files you supply. It does **not** translate
anything and uploads nothing — everything runs locally in the popup.

## How it works
1. Choose the first SRT (e.g. the original) and the second SRT (e.g. the translation).
2. Pick track order (A-over-B or B-over-A) and the separator between the two texts.
3. Click **Merge files** — cues are paired by time overlap, so files with slightly
   different cue splits still line up.
4. Preview the result, then **Download merged SRT**.

Options: renumber cues 1..N in the output (on by default). Cues in track A with no
overlapping partner in track B are kept with just their own text.

## Files
- `manifest.json` — Manifest V3
- `popup.html` / `popup.css` / `popup.js` — the whole tool lives in the popup
- `icons/` — 16/48/128 PNG icons

## Permissions
- `storage` — remembers nothing sensitive; used minimally for future settings.

## Privacy
100% local. Your subtitle files never leave the machine.
