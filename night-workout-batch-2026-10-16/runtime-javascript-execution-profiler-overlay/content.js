/* Runtime JS Profiler — content script.
   Injected on demand (click-only via chrome.scripting). Measures long tasks
   (>50ms) with PerformanceObserver and frame rate via rAF. Draws a dismissible
   overlay on the page. 100% local; nothing leaves the device.
   Guard: never inject twice in the same page context. */
(() => {
  'use strict';
  if (window.__jsProfilerInstalled) return;
  window.__jsProfilerInstalled = true;

  const LONG_TASK_THRESHOLD = 50; // ms

  const state = {
    running: false,
    longTasks: [],      // {dur, src}
    frames: [],         // timestamps of rAF ticks
    observer: null,
    rafId: 0,
    overlay: null,
    canvas: null,
  };

  /* Guess a human-readable source for a longtask entry. */
  function sourceOf(entry) {
    try {
      if (entry.attribution && entry.attribution.length) {
        const a = entry.attribution[0];
        if (a.containerSrc) return a.containerSrc.split('/').pop() || 'inline script';
        if (a.name && a.name !== 'unknown') return a.name.split('/').pop() || a.name;
      }
    } catch (e) { /* attribution is best-effort */ }
    return '(page script)';
  }

  /* ---- Frame-rate tracking ---- */
  function tick(ts) {
    if (!state.running) return;
    state.frames.push(ts);
    // keep a 5s rolling window
    const cutoff = ts - 5000;
    while (state.frames.length && state.frames[0] < cutoff) state.frames.shift();
    state.rafId = requestAnimationFrame(tick);
  }

  function fpsAvg() {
    const n = state.frames.length;
    if (n < 2) return 0;
    const span = state.frames[n - 1] - state.frames[0];
    return span > 0 ? (1000 * (n - 1)) / span : 0;
  }

  /* ---- Overlay ---- */
  function buildOverlay() {
    const root = document.createElement('div');
    root.id = '__js-profiler-overlay';
    root.style.cssText = [
      'position:fixed', 'right:14px', 'bottom:14px', 'z-index:2147483647',
      'width:300px', 'background:rgba(16,16,22,.92)', 'backdrop-filter:blur(10px)',
      'border:1px solid rgba(251,146,60,.45)', 'border-radius:14px',
      'color:#e8eaf0', 'font:12px/1.45 system-ui,sans-serif',
      'padding:12px 14px', 'box-shadow:0 12px 40px rgba(0,0,0,.5)',
    ].join(';');

    const head = document.createElement('div');
    head.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;';
    const title = document.createElement('strong');
    title.textContent = '⚡ JS Profiler';
    const close = document.createElement('button');
    close.textContent = '✕';
    close.setAttribute('aria-label', 'Dismiss overlay');
    close.style.cssText = 'background:none;border:none;color:#9aa0b4;font-size:14px;cursor:pointer;';
    close.onclick = () => { root.remove(); state.overlay = null; };
    head.append(title, close);

    const canvas = document.createElement('canvas');
    canvas.width = 272; canvas.height = 64;
    canvas.style.cssText = 'width:100%;height:64px;border-radius:8px;background:rgba(255,255,255,.04);';

    const stats = document.createElement('div');
    stats.id = '__js-profiler-stats';
    stats.style.cssText = 'margin-top:8px;font-size:12px;color:#b9bed2;';

    root.append(head, canvas, stats);
    document.documentElement.appendChild(root);
    state.overlay = root;
    state.canvas = canvas;
  }

  function drawGraph() {
    if (!state.canvas) return;
    const ctx = state.canvas.getContext('2d');
    const W = state.canvas.width, H = state.canvas.height;
    ctx.clearRect(0, 0, W, H);
    // draw long tasks as bars over time (last 10s)
    const now = performance.now();
    const windowMs = 10000;
    const recent = state.longTasks.filter(t => now - t.at <= windowMs);
    ctx.fillStyle = '#fb923c';
    recent.forEach(t => {
      const x = W - ((now - t.at) / windowMs) * W;
      const h = Math.min(H, (t.dur / 500) * H);
      ctx.fillRect(Math.max(0, x - 2), H - h, 3, h);
    });
    // fps line
    const fps = fpsAvg();
    ctx.fillStyle = '#e8eaf0';
    ctx.font = '11px system-ui';
    ctx.fillText('FPS: ' + fps.toFixed(0) + '  •  long tasks: ' + state.longTasks.length, 8, 14);
    ctx.fillStyle = 'rgba(255,255,255,.25)';
    ctx.fillRect(0, H - 1, W, 1);
  }

  function refreshOverlay() {
    if (!state.overlay) return;
    const el = document.getElementById('__js-profiler-stats');
    if (!el) return;
    const total = state.longTasks.reduce((a, t) => a + t.dur, 0);
    const worst = state.longTasks.reduce((m, t) => Math.max(m, t.dur), 0);
    el.innerHTML = '';
    const rows = [
      ['Long tasks', state.longTasks.length],
      ['Worst task', worst ? worst.toFixed(0) + ' ms' : '—'],
      ['Main-thread blocked', total ? total.toFixed(0) + ' ms' : '—'],
    ];
    rows.forEach(([k, v]) => {
      const d = document.createElement('div');
      d.style.cssText = 'display:flex;justify-content:space-between;padding:2px 0;';
      const a = document.createElement('span'); a.textContent = k;
      const b = document.createElement('strong'); b.style.color = '#fb923c'; b.textContent = String(v);
      d.append(a, b); el.appendChild(d);
    });
    drawGraph();
  }

  /* ---- Profiling control ---- */
  function start() {
    if (state.running) return true;
    state.running = true;
    state.longTasks = [];
    state.frames = [];
    try {
      state.observer = new PerformanceObserver(list => {
        list.getEntries().forEach(entry => {
          state.longTasks.push({ dur: entry.duration, src: sourceOf(entry), at: performance.now() });
        });
      });
      state.observer.observe({ entryTypes: ['longtask'] });
    } catch (e) {
      // longtask not supported (e.g. Firefox): FPS-only mode
      state.observer = null;
    }
    state.rafId = requestAnimationFrame(tick);
    if (!state.overlay || !document.body.contains(state.overlay)) buildOverlay();
    return true;
  }

  function stop() {
    state.running = false;
    if (state.observer) { state.observer.disconnect(); state.observer = null; }
    cancelAnimationFrame(state.rafId);
    return true;
  }

  function snapshot() {
    const total = state.longTasks.reduce((a, t) => a + t.dur, 0);
    const worst = state.longTasks.reduce((m, t) => Math.max(m, t.dur), 0);
    const bySrc = {};
    state.longTasks.forEach(t => { bySrc[t.src] = (bySrc[t.src] || 0) + t.dur; });
    const top = Object.entries(bySrc)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([src, dur]) => ({ src: src.slice(-42), dur }));
    return {
      ok: true,
      running: state.running,
      fpsAvg: fpsAvg(),
      stats: { count: state.longTasks.length, worst, total, top },
      longtaskSupported: true,
    };
  }

  /* Live overlay refresh every second while profiling. */
  setInterval(() => { if (state.running) refreshOverlay(); }, 1000);

  /* ---- Message handler ---- */
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.cmd === 'profiler:start') sendResponse({ ok: start() });
    else if (msg.cmd === 'profiler:stop') sendResponse({ ok: stop() });
    else if (msg.cmd === 'profiler:get') { if (state.running) refreshOverlay(); sendResponse(snapshot()); }
    else sendResponse({ ok: false, error: 'unknown command' });
    return true;
  });
})();
