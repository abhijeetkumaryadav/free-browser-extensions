# Caffeine Decay Graph — Half-Life Visualizer

Log caffeine doses (mg + time); the extension draws an exponential decay curve
of estimated remaining caffeine using a configurable half-life (default 5.7h),
with a bedtime marker showing how much is estimated to remain when you sleep.

## Honest scope

- **Math model, not medical advice.** The graph is exponential decay math
  (`mg × 0.5^(t / halfLife)`). Real caffeine metabolism varies with genetics,
  tolerance, food, and medication. It cannot tell you how you feel or when
  it's safe to sleep — it's a visualization of a formula.
- No intake advice, no product data, nothing fetched. Everything you log stays
  in `chrome.storage.local`. Zero network.

## Features

- Log mg + time; per-dose delete; clear-all with confirm
- Live "mg in system now" readout, ticking every minute
- Decay curve from now to bedtime + 2h, with "mg at bedtime" label
- Adjustable half-life (2–12h) and bedtime; settings persist

## Files

- `manifest.json` — MV3 (permission: `storage` only)
- `popup.html` / `popup.css` / `popup.js` — UI; pure engine (`decayedMg`,
  `totalRemaining`, `sampleCurve`, `nextTimeMs`, `fmtTime`) between
  `// ENGINE-START` and `// ENGINE-END`
- `README.md`, `icons/icon{16,48,128}.png`

## Privacy

All data stays on your device. Nothing is transmitted.
