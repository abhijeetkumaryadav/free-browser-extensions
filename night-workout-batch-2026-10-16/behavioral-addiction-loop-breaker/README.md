# LoopBreaker — Behavioral Addiction Loop Breaker

A gentle friction tool against addictive page patterns. It **never blocks**
sites — it spots loops and nudges you to take breathers.

## What it does

- **Check this page**: on-demand heuristic scan for addictive patterns —
  infinite scroll, autoplay video, streak/reward hooks, notification bait,
  ephemeral stories. Each finding is labeled with a plain explanation.
- **Protection on**: when enabled, every page you visit gets a visible-time
  timer; after your chosen interval a calming **breather overlay** appears for
  a short pause (skippable with one click).
- **Today stats**: breathers taken, mindful minutes, loops spotted.

## Honest scope

- Pattern detection is **heuristic DOM clue-matching** — it can miss real
  loops and misfire on harmless pages.
- 100% local: no network, no accounts, nothing leaves the device.

## Permissions

| Permission | Why |
|---|---|
| `storage` | Settings + daily stats |
| `alarms` | Daily stats heartbeat |
| `activeTab` | Check only the tab you click on |
| `scripting` | Inject the scanner / friction overlay |

## Install (developer mode)

1. Open `chrome://extensions`, enable **Developer mode**.
2. **Load unpacked** → select this folder.
3. Toggle protection on in the popup, then browse normally.
