/* Cursor Gravity Particles — content script (injected on explicit click only).
 * Full-viewport canvas overlay; the page underneath is never touched.
 * Guards against double injection. */
'use strict';

if (!window.__gravityParticlesLoaded) {
  window.__gravityParticlesLoaded = true;

  const OVERLAY_ID = '__gp_overlay';
  let sim = null; // { canvas, ctx, parts, mouse, gravity, trail, raf }

  const PALETTE = ['#f472b6', '#22d3ee', '#a78bfa', '#fbbf24', '#4ade80', '#fb923c'];

  function rand(a, b) { return a + Math.random() * (b - a); }

  function makeParticles(n) {
    const parts = [];
    for (let i = 0; i < n; i++) {
      parts.push({
        x: rand(0, innerWidth), y: rand(0, innerHeight),
        vx: rand(-1, 1), vy: rand(-1, 1),
        r: rand(1.5, 4.5),
        color: PALETTE[(Math.random() * PALETTE.length) | 0]
      });
    }
    return parts;
  }

  function start(opts) {
    stop();
    const canvas = document.createElement('canvas');
    canvas.id = OVERLAY_ID;
    canvas.width = innerWidth; canvas.height = innerHeight;
    canvas.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none;';
    document.documentElement.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    sim = {
      canvas, ctx,
      parts: makeParticles(opts.count ?? 140),
      mouse: { x: innerWidth / 2, y: innerHeight / 2, inside: false },
      gravity: opts.gravity ?? 90,
      trail: opts.trail ?? 55,
      raf: 0
    };
    addEventListener('pointermove', onMove, { passive: true });
    addEventListener('keydown', onKey);
    addEventListener('resize', onResize);
    loop();
  }

  function onMove(e) { if (sim) { sim.mouse.x = e.clientX; sim.mouse.y = e.clientY; sim.mouse.inside = true; } }
  function onKey(e) { if (e.key === 'Escape') { stop(); chrome.runtime.sendMessage({ action: '__gp_stopped' }).catch(() => {}); } }
  function onResize() { if (sim) { sim.canvas.width = innerWidth; sim.canvas.height = innerHeight; } }

  function loop() {
    if (!sim) return;
    const { ctx, parts, mouse, gravity, trail } = sim;
    // Trail effect: fade previous frame instead of clearing.
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(8,10,16,${1 - trail / 110})`;
    ctx.fillRect(0, 0, sim.canvas.width, sim.canvas.height);

    const g = gravity / 60; // per-frame-ish scale
    for (const p of parts) {
      // Gravitational pull toward cursor.
      const dx = mouse.x - p.x, dy = mouse.y - p.y;
      const dist = Math.hypot(dx, dy) || 1;
      const pull = mouse.inside ? (g * 220) / (dist * dist + 900) : 0;
      p.vx += (dx / dist) * pull;
      p.vy += (dy / dist) * pull;
      // Gentle damping + drift so the field stays lively.
      p.vx *= 0.985; p.vy *= 0.985;
      p.vx += rand(-0.08, 0.08); p.vy += rand(-0.08, 0.08);
      p.x += p.vx; p.y += p.vy;
      // Soft walls.
      if (p.x < 0 || p.x > sim.canvas.width) p.vx *= -1;
      if (p.y < 0 || p.y > sim.canvas.height) p.vy *= -1;
      p.x = Math.max(0, Math.min(sim.canvas.width, p.x));
      p.y = Math.max(0, Math.min(sim.canvas.height, p.y));

      ctx.globalCompositeOperation = 'lighter';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = 0.9;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    sim.raf = requestAnimationFrame(loop);
  }

  function stop() {
    if (!sim) return;
    cancelAnimationFrame(sim.raf);
    removeEventListener('pointermove', onMove);
    removeEventListener('keydown', onKey);
    removeEventListener('resize', onResize);
    sim.canvas.remove();
    sim = null;
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.__ping) { sendResponse(true); return true; }
    if (!msg || !msg.action) return false;
    if (msg.action === 'start') {
      start({ gravity: msg.gravity ?? 90, count: msg.count ?? 140, trail: msg.trail ?? 55 });
      sendResponse({ ok: true });
    } else if (msg.action === 'settings') {
      if (sim) {
        sim.gravity = msg.gravity ?? sim.gravity;
        sim.trail = msg.trail ?? sim.trail;
        const want = msg.count ?? sim.parts.length;
        if (want > sim.parts.length) sim.parts.push(...makeParticles(want - sim.parts.length));
        else sim.parts.length = want;
      }
      sendResponse({ ok: true });
    } else if (msg.action === 'stop') {
      stop();
      sendResponse({ ok: true });
    }
    return true;
  });
}
