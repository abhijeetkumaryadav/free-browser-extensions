# Sun Salutation Flow — Side Panel Guide

An interactive Surya Namaskar (sun salutation) guide that lives in the
browser side panel: the 12-pose sequence with plain-language descriptions, a
per-pose timer with a generated chime, auto-advance, and a round counter.
Uses the **stable** `chrome.sidePanel` API — not experimental. Everything is
local; no network.

## Honest scope

- **Pose guide — not coaching advice.** Move gently; stop if anything hurts.
- The chime is a generated Web Audio tone (no audio files).
- Timers are pacing aids; the extension cannot observe your actual practice.

## Use

1. Click the toolbar button and press **Open side panel**.
2. Set **hold per pose** (10–90s) and toggle **auto-advance with chime**.
3. Press **Start flow**. Each pose shows a countdown ring; finishing all 12
   poses increments the **round counter**.
4. Click any pose in the **Sequence** list to jump to it; **Prev/Next** move
   manually; **Reset flow** restarts.

## Files

- `manifest.json` — MV3 manifest (`sidePanel` + `storage` + `tabs`), stable
  `side_panel.default_path`
- `popup.html` / `popup.css` / `popup.js` — launcher that opens the panel
- `panel.html` / `panel.css` / `panel.js` — the interactive guide
  (`POSES`, `nextPoseIndex`, `buildRoundPlan`, `ringFraction` between
  `ENGINE-START` / `ENGINE-END` markers are pure and headless-testable)
- `icons/` — generated 16/48/128 PNG icons
