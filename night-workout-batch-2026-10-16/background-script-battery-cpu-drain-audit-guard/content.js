// Page Activity Audit — content script.
// Injected on demand (click-only) for a short measurement window.
// Measures: longtask entries (>50ms main-thread blocks), frame rate
// via rAF, event-loop lag via setTimeout(0) deltas, and network
// resource churn. Read-only measurement — never alters the page.
(function () {
  'use strict';

  // Guard against double injection on repeated scans.
  if (window.__paaRunning) {
    chrome.storage.local.set({ paa_busy: true });
    return;
  }
  window.__paaRunning = true;
  chrome.storage.local.set({ paa_busy: true });

  const DURATION_MS = 5000;

  // ---- Long tasks -------------------------------------------------------
  const longTasks = [];
  let longTaskObserver = null;
  try {
    if ('PerformanceObserver' in window) {
      longTaskObserver = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          longTasks.push({
            duration: Math.round(e.duration),
            // Attribution is best-effort; browsers limit third-party detail.
            name: (e.attribution && e.attribution[0] && e.attribution[0].name) || 'main thread'
          });
        }
      });
      // 'longtask' is not available in Firefox — guarded with try/catch.
      longTaskObserver.observe({ type: 'longtask', buffered: true });
    }
  } catch (err) {
    // No longtask support (e.g. Firefox) — FPS/lag metrics still work.
  }

  // ---- Frame rate -------------------------------------------------------
  let frames = 0;
  let rafId = 0;
  let running = true;
  const start = performance.now();
  function tick() {
    if (!running) return;
    frames += 1;
    rafId = requestAnimationFrame(tick);
  }
  tick();

  // ---- Event-loop lag ---------------------------------------------------
  // Runaway timers/handlers keep the loop busy; lag grows. Sample the
  // delay of setTimeout(0) callbacks — each ~0ms delay above expected is
  // the event loop being busy with other work.
  const lags = [];
  let lagSamples = 0;
  const MAX_LAG_SAMPLES = 200;
  function sampleLag() {
    if (!running || lagSamples >= MAX_LAG_SAMPLES) return;
    const t0 = performance.now();
    setTimeout(() => {
      lags.push(Math.max(0, performance.now() - t0));
      lagSamples += 1;
      sampleLag();
    }, 0);
  }
  sampleLag();

  // ---- Network resource churn -------------------------------------------
  const resourcesBefore = performance.getEntriesByType('resource').length;

  // ---- Finish and report ------------------------------------------------
  setTimeout(() => {
    running = false;
    cancelAnimationFrame(rafId);
    if (longTaskObserver) longTaskObserver.disconnect();

    const elapsed = (performance.now() - start) / 1000;
    const fps = Math.round(frames / elapsed);
    const resourcesAfter = performance.getEntriesByType('resource').length;

    const sortedLags = lags.slice().sort((a, b) => a - b);
    const avgLag = lags.length
      ? lags.reduce((a, b) => a + b, 0) / lags.length
      : 0;
    // p95 lag — how bad the worst moments were.
    const p95Lag = sortedLags.length
      ? sortedLags[Math.min(sortedLags.length - 1, Math.floor(sortedLags.length * 0.95))]
      : 0;

    const totalBlocked = longTasks.reduce((a, t) => a + t.duration, 0);

    chrome.storage.local.set({
      paa_busy: false,
      paa_result: {
        url: location.href,
        title: document.title,
        measuredAt: Date.now(),
        durationMs: DURATION_MS,
        longTaskCount: longTasks.length,
        totalBlockedMs: Math.round(totalBlocked),
        worstLongTaskMs: longTasks.length
          ? Math.max(...longTasks.map((t) => t.duration))
          : 0,
        fps,
        avgLoopLagMs: Math.round(avgLag * 10) / 10,
        p95LoopLagMs: Math.round(p95Lag * 10) / 10,
        resourcesLoaded: resourcesAfter - resourcesBefore,
        totalResources: resourcesAfter,
        longTaskSupported: longTaskObserver !== null
      }
    });

    window.__paaRunning = false;
  }, DURATION_MS);
})();
