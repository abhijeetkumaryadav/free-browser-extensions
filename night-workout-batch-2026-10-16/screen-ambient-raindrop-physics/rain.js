/* Rain Overlay — content script. Full-viewport canvas of raindrops with
 * simple physics: gravity, wind drift, ripple rings and splash streaks on
 * impact. Pointer-events pass through; purely visual; no tracking. */
'use strict';

(() => {
  // Re-injection guard: reboot the existing overlay instead of duplicating it.
  if (window.__rainOverlayLoaded) {
    window.__rainOverlayReboot?.();
    return;
  }
  window.__rainOverlayLoaded = true;

  const HOST_ID = 'rain-overlay-host';
  const DEFAULTS = { enabled: true, intensity: 5, wind: 2, ripples: true, splash: true };
  const GRAVITY = 2600;        // px/s^2 — snappy but calm fall
  const MAX_DROPS = 420;       // perf cap
  const MAX_RIPPLES = 120;

  let settings = { ...DEFAULTS };
  let host = null, canvas = null, ctx = null;
  let rafId = 0, last = 0, running = false;
  let drops = [], ripples = [], splashes = [];

  /* ---------- Setup / teardown ---------- */
  function build() {
    host = document.createElement('div');
    host.id = HOST_ID;
    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `
      :host { position: fixed; inset: 0; z-index: 2147483646;
              pointer-events: none; width: 100vw; height: 100vh; }
      canvas { width: 100vw; height: 100vh; display: block; }
    `;
    canvas = document.createElement('canvas');
    shadow.appendChild(style);
    shadow.appendChild(canvas);
    document.documentElement.appendChild(host);
    ctx = canvas.getContext('2d');
    resize();
  }

  function resize() {
    if (!canvas) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function teardown() {
    running = false;
    cancelAnimationFrame(rafId);
    window.removeEventListener('resize', resize);
    document.removeEventListener('visibilitychange', onVisibility);
    host?.remove();
    host = null;
    drops = []; ripples = []; splashes = [];
    window.__rainOverlayLoaded = false;
  }

  window.__rainOverlayReboot = () => { if (!host) start(); };

  /* ---------- Particles ---------- */
  /** Spawn one drop just above the viewport with slight randomisation. */
  function spawnDrop() {
    drops.push({
      x: Math.random() * (innerWidth + 200) - 100,
      y: -20 - Math.random() * 40,
      vy: 300 + Math.random() * 260,      // initial fall speed px/s
      len: 12 + Math.random() * 14,       // streak length
      drift: (Math.random() - 0.5) * 30,  // per-drop jitter
    });
  }

  /** A drop hit the impact zone — make a ripple ring + optional splash. */
  function impact(d) {
    const floor = innerHeight - 6;
    if (settings.ripples && ripples.length < MAX_RIPPLES) {
      ripples.push({ x: d.x, y: floor, r: 2, maxR: 14 + Math.random() * 14, alpha: 0.5 });
    }
    if (settings.splash && splashes.length < MAX_RIPPLES) {
      for (let i = 0; i < 3; i++) {
        splashes.push({
          x: d.x, y: floor,
          vx: (Math.random() - 0.5) * 160,
          vy: -(60 + Math.random() * 140),
          life: 0.35 + Math.random() * 0.2,
        });
      }
    }
  }

  /* ---------- Frame update ---------- */
  function update(dt) {
    // Maintain drop population from the intensity setting (1–10 → 0–~200).
    const target = Math.round(settings.intensity * 20);
    if (drops.length < Math.min(target, MAX_DROPS)) {
      const n = Math.min(6, Math.min(target, MAX_DROPS) - drops.length);
      for (let i = 0; i < n; i++) spawnDrop();
    }

    const windPx = settings.wind * 22; // -10..10 → px/s drift
    const floor = innerHeight - 6;

    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      d.vy += GRAVITY * dt;
      d.y += d.vy * dt;
      d.x += (windPx + d.drift) * dt;
      if (d.y >= floor) { impact(d); drops.splice(i, 1); }
      else if (d.x < -160 || d.x > innerWidth + 160) drops.splice(i, 1);
    }

    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i];
      r.r += 46 * dt;
      r.alpha -= 0.9 * dt;
      if (r.r >= r.maxR || r.alpha <= 0) ripples.splice(i, 1);
    }

    for (let i = splashes.length - 1; i >= 0; i--) {
      const s = splashes[i];
      s.vy += 900 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      if (s.life <= 0 || s.y > innerHeight) splashes.splice(i, 1);
    }
  }

  /* ---------- Render ---------- */
  function draw() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);

    // Drops as wind-slanted streaks.
    ctx.lineCap = 'round';
    for (const d of drops) {
      const slant = (settings.wind * 22 + d.drift) * 0.03;
      ctx.strokeStyle = 'rgba(147, 197, 253, 0.55)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x - slant, d.y - d.len);
      ctx.stroke();
    }

    // Ripple rings expanding on the "ground".
    for (const r of ripples) {
      ctx.strokeStyle = `rgba(125, 211, 252, ${Math.max(r.alpha, 0).toFixed(3)})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, r.r, r.r * 0.38, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Splash micro-streaks.
    for (const s of splashes) {
      ctx.strokeStyle = `rgba(186, 230, 253, ${Math.max(s.life * 1.6, 0).toFixed(3)})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x - s.vx * 0.03, s.y - s.vy * 0.03);
      ctx.stroke();
    }
  }

  function loop(now) {
    if (!running) return;
    rafId = requestAnimationFrame(loop);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    update(dt);
    draw();
  }

  function onVisibility() {
    // Pause the loop while hidden to save CPU; resume seamlessly.
    if (document.hidden) { running = false; cancelAnimationFrame(rafId); }
    else if (host) { running = true; last = performance.now(); rafId = requestAnimationFrame(loop); }
  }

  /* ---------- Start ---------- */
  async function start() {
    const stored = (await chrome.storage.local.get('rain')).rain;
    settings = { ...DEFAULTS, ...(stored || {}) };
    if (!settings.enabled) return;
    build();
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', onVisibility);
    running = true;
    last = performance.now();
    rafId = requestAnimationFrame(loop);
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === 'rain-stop') teardown();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.rain) {
      const next = { ...DEFAULTS, ...changes.rain.newValue };
      const wasEnabled = settings.enabled;
      settings = next;
      if (wasEnabled && !next.enabled) teardown();
      if (!wasEnabled && next.enabled && !host) start();
    }
  });

  start();
})();
