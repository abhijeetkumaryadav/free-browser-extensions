/* Gravity Sandbox — content script.
 * Visual toy overlay: particles drift on a canvas and swirl into gravity
 * wells the user places with a click. The page DOM is never modified;
 * teardown removes every trace (canvas, hint, listeners). 100% local.
 */
(() => {
  'use strict';
  if (window.__spsBooted) return; // already running on this tab
  window.__spsBooted = true;

  const PALETTE = ['#22d3ee', '#a78bfa', '#f472b6', '#fbbf24', '#4ade80'];
  const SOFT = 900; // gravitational softening — avoids singularity blow-ups

  // --- Overlay surface -------------------------------------------------------
  const canvas = document.createElement('canvas');
  Object.assign(canvas.style, {
    position: 'fixed', inset: '0', width: '100vw', height: '100vh',
    zIndex: '2147483647', cursor: 'crosshair', display: 'block',
  });
  document.documentElement.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  const hint = document.createElement('div');
  hint.textContent = 'Click: add gravity well · Shift+Click: remove well · Esc: exit';
  Object.assign(hint.style, {
    position: 'fixed', left: '50%', bottom: '14px', transform: 'translateX(-50%)',
    zIndex: '2147483647', pointerEvents: 'none', color: '#9fd8e3',
    background: 'rgba(12,14,20,.75)', border: '1px solid rgba(34,211,238,.35)',
    borderRadius: '999px', padding: '6px 14px', font: '12px system-ui, sans-serif',
    whiteSpace: 'nowrap',
  });
  document.documentElement.appendChild(hint);

  // --- State -----------------------------------------------------------------
  let W = 0, H = 0;
  let particles = [];
  let wells = [];
  let running = true;
  let raf = 0;
  const settings = { gravity: 80, count: 160, trail: 25 };

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function spawn() {
    particles = [];
    for (let i = 0; i < settings.count; i++) {
      particles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        r: 1.4 + Math.random() * 2.2,
        c: PALETTE[i % PALETTE.length],
      });
    }
  }

  /** Pull settings from storage; respawn particles if the count changed. */
  function pullSettings(done) {
    chrome.storage.local.get(
      { sps_gravity: 80, sps_particles: 160, sps_trail: 25 },
      (r) => {
        const oldCount = settings.count;
        settings.gravity = r.sps_gravity;
        settings.count = r.sps_particles;
        settings.trail = r.sps_trail;
        if (oldCount !== settings.count) spawn();
        if (done) done();
      }
    );
  }

  // --- Simulation ------------------------------------------------------------
  function frame() {
    if (!running) return;

    // Fade the previous frame instead of clearing -> motion trails.
    const alpha = Math.max(0.08, 1 - settings.trail / 100);
    ctx.fillStyle = 'rgba(8,8,13,' + alpha.toFixed(3) + ')';
    ctx.fillRect(0, 0, W, H);

    const G = settings.gravity;
    for (const p of particles) {
      let ax = 0, ay = 0;
      for (const w of wells) {
        const dx = w.x - p.x, dy = w.y - p.y;
        const d2 = dx * dx + dy * dy + SOFT;
        const d = Math.sqrt(d2);
        const f = Math.min((G * 40) / d2, 2.2); // capped inverse-square pull
        ax += (f * dx) / d;
        ay += (f * dy) / d;
      }
      p.vx = (p.vx + ax) * 0.986; // mild damping keeps orbits stable
      p.vy = (p.vy + ay) * 0.986;
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0) { p.x = 0; p.vx *= -0.8; }
      if (p.x > W) { p.x = W; p.vx *= -0.8; }
      if (p.y < 0) { p.y = 0; p.vy *= -0.8; }
      if (p.y > H) { p.y = H; p.vy *= -0.8; }
    }

    // Wells: glowing ring markers.
    for (const w of wells) {
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(34,211,238,.9)';
      ctx.beginPath(); ctx.arc(w.x, w.y, 10, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = 'rgba(34,211,238,.35)';
      ctx.beginPath(); ctx.arc(w.x, w.y, 22, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#22d3ee';
      ctx.beginPath(); ctx.arc(w.x, w.y, 3, 0, Math.PI * 2); ctx.fill();
    }
    // Particles.
    for (const p of particles) {
      ctx.fillStyle = p.c;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }

    raf = requestAnimationFrame(frame);
  }

  // --- Interaction -----------------------------------------------------------
  function onClick(e) {
    if (e.shiftKey) {
      // Remove the nearest well within 70px.
      let best = -1, bd = 70 * 70;
      wells.forEach((w, i) => {
        const d2 = (w.x - e.clientX) * (w.x - e.clientX) + (w.y - e.clientY) * (w.y - e.clientY);
        if (d2 < bd) { bd = d2; best = i; }
      });
      if (best >= 0) wells.splice(best, 1);
    } else {
      wells.push({ x: e.clientX, y: e.clientY });
    }
  }

  function onKey(e) { if (e.key === 'Escape') stop(); }

  function onStorage(changes) {
    if (changes.sps_active && changes.sps_active.newValue === false) { stop(); return; }
    if (changes.sps_gravity || changes.sps_particles || changes.sps_trail) pullSettings();
  }

  /** Full teardown: stop the loop, remove nodes and listeners. */
  function stop() {
    if (!window.__spsBooted && !running) return;
    running = false;
    cancelAnimationFrame(raf);
    canvas.removeEventListener('click', onClick);
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('resize', resize);
    if (chrome.storage && chrome.storage.onChanged) chrome.storage.onChanged.removeListener(onStorage);
    canvas.remove();
    hint.remove();
    window.__spsBooted = false;
    chrome.storage.local.set({ sps_active: false });
  }

  canvas.addEventListener('click', onClick);
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('resize', resize);
  chrome.storage.onChanged.addListener(onStorage);

  resize();
  pullSettings(() => { spawn(); frame(); });
})();
