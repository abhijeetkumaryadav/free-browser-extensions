# Browser Benchmark — This-Browser Micro-Benchmarks

Runs local JavaScript micro-benchmarks **in THIS browser only** and keeps a run
history so you can compare your own runs over time.

## Honest scope

**Benchmarks THIS browser only — NOT a cross-browser comparison.** There is no
way for an extension to install or measure other browsers; the scores compare
your own runs over time (e.g. before/after a browser update or on different
machines, by exporting nothing — the history is just yours to eyeball).

## What it does

- 6 bundled DOM-free benchmarks: array sort, array map+filter, string build,
  regex scan, math crunch (1M trig+sqrt), object churn
- Each benchmark runs 5 timed repetitions; the median is scored as ops/sec
- Per-benchmark bars, total score, and a run history with % change vs the
  previous run (keeps the last 30 runs)
- Clear-history button

## Files

`manifest.json`, `popup.html`, `popup.css`, `popup.js`, `README.md`,
`icons/icon{16,48,128}.png`.

## Permissions

- `storage` — persists run history locally. That's it. Zero network, zero
  telemetry.

## Install (development)

1. Open `chrome://extensions` (or `edge://extensions`).
2. Enable **Developer mode**.
3. **Load unpacked** → select this folder.
4. Click the toolbar icon → tick benchmarks → **Run selected**.
