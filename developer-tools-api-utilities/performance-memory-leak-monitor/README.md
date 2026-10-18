# Performance Memory Leak Monitor v1.0.0

Hit **Start** on any tab to sample its JS heap (`performance.memory`)
every 2 seconds and watch it on a live growth chart with min/max/
growth stats. If the heap climbs steadily (least-squares slope over
the last 20 samples), a **"Possible memory leak"** warning appears.

Honest heuristic, not proof of a leak — the popup says so. Keep the
popup open while sampling (up to 120 samples). Tip: force GC via
DevTools → Performance → 🗑 before measuring, and reload the tab to
compare baselines.

Chrome/Edge only — Firefox doesn't expose `performance.memory`, and
the popup says so gracefully instead of failing silently.

## Try it
1. Unzip `performance-memory-leak-monitor.zip`.
2. `chrome://extensions` (or `edge://extensions`) → Developer mode → **Load unpacked** → select the folder.
3. Open a heavy web app → **Start** → interact with the page → watch the chart.

## Permissions
- `activeTab` + `scripting`: read `performance.memory` from the tab you monitor.
- Nothing is stored or uploaded.

## Publishing notes
- Chrome Web Store: $5 one-time developer fee.
- Edge Add-ons: free submission.
