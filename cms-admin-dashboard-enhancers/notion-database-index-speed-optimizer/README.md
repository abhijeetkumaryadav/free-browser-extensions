# Notion Database Index Speed Optimizer v1.0.0

Heuristic design reviewer for Notion databases. Paste a property list, get
actionable speed/structure suggestions, a persistent speed checklist, and
copy-paste formula helpers.

**Honest scope, stated everywhere in the UI:** this is offline advice based on
community best practices. It cannot see your Notion workspace, row counts, or
real performance data, and it never asks for credentials or API tokens.

## What it does

- **Analyze** — paste one property per line as `Name (Type)`, e.g. `Due (Date)`.
  The analyzer checks: Title presence, relation count, rollup/formula load,
  total width, long property names, media columns, and select sprawl — then
  gives a 0–100 score with Good / Watch / Fix suggestions.
- **Speed checklist** — 8 best-practice items with persistent checkboxes.
- **Formula helpers** — 5 common Notion formulas (days-until-due, overdue flag,
  progress bar, auto-status, title-case) with one-click copy.
- **Sample** button loads a demo property list.

All on-device. No network calls, ever.

## Install

1. Unzip `notion-database-index-speed-optimizer.zip`.
2. Open `chrome://extensions` (Edge: `edge://extensions`; Firefox:
   `about:debugging` → "Load Temporary Add-on").
3. Enable **Developer mode**.
4. **Load unpacked** → select the unzipped folder.

## Permissions (minimal, justified)

| Permission | Why |
|---|---|
| `storage` | Remembers your last property list and checklist state on-device. |
| `clipboardWrite` | "Copy" buttons for formula snippets. |

No host permissions. No credentials requested. No data leaves the device.

## Publishing notes

- Manifest V3, no deprecated APIs.
- Privacy: no remote code, no analytics, no account linking — declare "does not
  collect data".
- Firefox: MV3 supported in Firefox 109+; promise-style `chrome.*` APIs work in
  Firefox MV3 builds.
