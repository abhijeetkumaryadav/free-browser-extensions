# Launch Window Planner — Orbital Plane Alignment Edu

An educational browser extension about launch windows and orbital plane alignment,
plus a personal planner for launch windows you enter yourself.

## Honest scope

**Educational only — not mission planning.** The explainer teaches the concepts
(launch windows, orbital plane alignment, the plane-change penalty) in plain
language. The planner only counts down to windows *you* enter — it has no
orbital mechanics, no live launch data, and no network access.

## Features

- **Next-window hero card** with a live 1-second countdown to your next planned window
- **My Windows**: add windows (name, date/time, target orbit, notes), delete,
  upcoming sorted by soonest, past dimmed
- **How It Works**: five plain-language lessons on launch windows, plane
  alignment, short windows, the plane-change penalty, and key terms
- All data stored locally in `chrome.storage.local`; zero network

## Permissions

- `storage` — save your planned windows locally

## Development

- Manifest V3, no deprecated APIs
- Popup 380px, deep-dark glassmorphism, one accent (#38bdf8), Lucide-style outline icons
- Engine functions (`makeWindow`, `splitWindows`, `nextWindow`, `countdownParts`,
  `fmtCountdown`, `fmtWhen`) live between `// ENGINE-START` / `// ENGINE-END` and
  are headless-testable (15/15 checks pass)
