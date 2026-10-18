# Runtime JS Profiler Overlay

On-demand performance profiler for the current tab. Click **Start profiling**,
interact with the page, and watch live stats: long tasks (>50ms), worst task,
total main-thread blocking, and average FPS — plus a dismissible overlay drawn
on the page with an FPS/long-task graph.

## Honest scope

- **Read-only measurement.** It observes performance; it never modifies page
  behaviour and never sends anything anywhere — 100% local.
- Long-task attribution (`sourceOf`) is best-effort: browsers limit how much
  they reveal about third-party scripts, so some tasks show as "(page script)".
- FPS is measured over a rolling 5-second window of the visible tab; minimized
  or background tabs throttle `requestAnimationFrame`, so numbers dip when the
  tab isn't visible — that's the browser, not the page.
- `longtask` entries aren't available in Firefox, so Firefox runs FPS-only.
- Not a lab benchmark: results depend on your device, battery, and background load.

## Files

- `manifest.json` — MV3, `storage` + `activeTab` + `scripting`
- `popup.html` / `popup.css` / `popup.js` — popup UI and orchestration
- `content.js` — on-demand injected profiler + overlay (guarded against double injection)
