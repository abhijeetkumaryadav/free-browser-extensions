# H1 Sleuth — Duplicate H1 Scanner

On-demand audit of a page's h1 usage: detects **duplicate/multiple h1s**, **missing
h1**, **empty h1s**, **hidden h1s**, and repeated identical heading text — with DOM
locations and plain-language fix guidance. Also renders the full heading outline
(h1–h6) for context.

## Honest scope

- **Read-only.** The page is never modified; only measured.
- Heuristic best-practice guidance (one visible, non-empty h1 per page), not a
  ranking guarantee. Some valid designs (e.g. SPAs, templates) intentionally use
  multiple h1s — the tool flags, you decide.
- 100% local — zero network.

## Features

- 0–100 h1 health score with verdict
- Stat tiles: h1 count, empty, hidden, issues
- Per-issue cards with severity, explanation, and CSS-path location
- Interactive heading outline tree (indented by level, dimmed when hidden)
- Last scan persists locally

## Permissions (minimal)

- `activeTab` + `scripting` — inject the measuring script on click only
- `storage` — persist the last scan locally

## Files

- `manifest.json` — MV3 manifest
- `popup.html` / `popup.css` / `popup.js` — popup UI and audit logic
- `content.js` — on-demand page measurement script
- `icons/` — 16/48/128 PNG icons
