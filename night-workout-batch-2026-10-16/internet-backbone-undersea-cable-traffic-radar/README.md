# Cable Radar — Undersea Cable Explainer

**Educational only — simulated radar, no live backbone or traffic data.** This
extension teaches how undersea cables work, shows a purely simulated radar
doodle (deterministic blips, nothing real), and stores your own notes locally.
It makes zero network calls and shows no real cable status.

## What it does

- **Simulated radar canvas** — sweeping radar with 7 deterministic blips that
  fade as the sweep passes. A doodle for fun, labeled as such.
- **Learn tab content** — 7 plain-language facts: 99% of intercontinental
  traffic goes through cables, cable ships, landing stations, repair cycles,
  and an explicit "this tool shows nothing live" card.
- **My notes** — title + note, newest-first, case-insensitive search,
  per-note delete, clear-all with confirm. All in `chrome.storage.local`.

## Permissions

- `storage` — save your notes locally. That's it.

## Privacy

Fully local. Zero network calls. No analytics, no telemetry.

## Files

- `manifest.json` — Manifest V3 config
- `popup.html` / `popup.css` / `popup.js` — popup + radar engine
  (`radarState`, `blipBrightness`, `mulberry`, `makeNote`, `sortNotes`,
  `filterNotes`, `fmtWhen`, `CABLE_FACTS` between
  `// ENGINE-START` / `// ENGINE-END`)
- `icons/` — 16/48/128 PNG icons
- `README.md` — this file
