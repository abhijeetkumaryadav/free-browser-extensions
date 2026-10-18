# Screen Crack Prank — Fake Cracked Screen

A harmless, explicitly user-triggered prank: draws a realistic fake cracked-screen
effect over the current tab.

## What it does

- Click **Crack this tab** in the popup to draw the fake crack overlay.
- The cracks are drawn on a transparent full-page canvas layer — the page and
  your data are completely untouched.
- Click **Remove cracks** (or press **Esc** on the page) to remove every trace.

## Honest scope

- **Prank, clearly labeled.** It only ever starts when you click the button —
  it never activates on its own, on load, or on any page automatically.
- **Fully reversible.** One click (or Esc) removes the overlay entirely.
- **100% local.** No network requests, no data collection, no remote code.

## Permissions

- `activeTab` + `scripting` — draw the overlay on the tab you click on, only
  when you click the button.

## Files

- `manifest.json` — MV3 manifest
- `popup.html` / `popup.css` / `popup.js` — popup UI and tab injection
- `content.js` — the crack drawing (injected on demand, never auto-run)
- `icons/` — generated PNG icons
