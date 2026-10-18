/* CrackScreen content script — fake screen-crack prank overlay.
 *
 * Self-executing and toggling: if the overlay is already present it is
 * removed (restore); otherwise it is built. Everything lives inside a
 * closed shadow-DOM host so page styles/scripts are untouched, and the
 * overlay is purely visual — nothing on the page is modified.
 */
(() => {
  'use strict';

  const HOST_ID = '__crackscreen-host';

  // Toggle off if the prank is already active.
  const existing = document.getElementById(HOST_ID);
  if (existing) {
    existing.remove();
    window.__crackScreenActive = false;
    return;
  }
  window.__crackScreenActive = true;

  const rand = (min, max) => min + Math.random() * (max - min);

  chrome.storage.local.get({ sound: true, density: 'medium' }, (opts) => {
    try { buildOverlay(opts); } catch (e) { /* never break the host page */ }
  });

  /* ---------- overlay scaffold ---------- */
  function buildOverlay(opts) {
    const host = document.createElement('div');
    host.id = HOST_ID;
    Object.assign(host.style, {
      position: 'fixed', inset: '0',
      zIndex: '2147483647', pointerEvents: 'none'
    });
    const shadow = host.attachShadow({ mode: 'closed' });

    const canvas = document.createElement('canvas');
    const W = window.innerWidth, H = window.innerHeight;
    canvas.width = W; canvas.height = H;
    Object.assign(canvas.style, {
      position: 'absolute', inset: '0', width: '100%', height: '100%'
    });
    shadow.appendChild(canvas);
    (document.documentElement || document.body).appendChild(host);

    // Impact point: center of the viewport (feels like the screen broke).
    const cx = W / 2, cy = H / 2;

    if (opts.sound) playShatterSound();

    const segments = computeCracks(cx, cy, W, H, opts.density);
    animateCracks(canvas, segments, () => showRestoreButton(shadow, host));
  }

  /* ---------- crack geometry ---------- */
  // Precompute every line segment so the reveal can animate progressively.
  function computeCracks(cx, cy, W, H, density) {
    const segments = [];
    const mainCount = density === 'light' ? 8 : density === 'heavy' ? 18 : 12;
    const reach = Math.hypot(W, H);

    for (let i = 0; i < mainCount; i++) {
      const angle = (i / mainCount) * Math.PI * 2 + rand(-0.25, 0.25);
      traceCrack(segments, cx, cy, angle, reach * rand(0.35, 0.62), 2.4, 0);
    }
    // Impact rings near the center.
    for (let r = 0; r < 3; r++) {
      const radius = rand(28, 60) + r * rand(30, 55);
      traceRing(segments, cx, cy, radius);
    }
    return segments;
  }

  function traceCrack(segments, x, y, angle, len, width, depth) {
    const steps = Math.max(3, Math.floor(len / 26));
    for (let s = 0; s < steps; s++) {
      angle += rand(-0.45, 0.45);
      const step = rand(14, 30);
      const nx = x + Math.cos(angle) * step;
      const ny = y + Math.sin(angle) * step;
      segments.push({ x1: x, y1: y, x2: nx, y2: ny, w: Math.max(0.6, width) });
      // Occasional sub-branch.
      if (depth < 2 && Math.random() < 0.38) {
        const dir = Math.random() < 0.5 ? 1 : -1;
        traceCrack(segments, nx, ny, angle + dir * rand(0.6, 1.3), len * 0.32, width * 0.55, depth + 1);
      }
      x = nx; y = ny;
    }
  }

  function traceRing(segments, cx, cy, radius) {
    const steps = 26;
    for (let i = 0; i < steps; i++) {
      const a1 = (i / steps) * Math.PI * 2;
      const a2 = ((i + 1) / steps) * Math.PI * 2;
      const wob = () => rand(-4, 4);
      segments.push({
        x1: cx + Math.cos(a1) * (radius + wob()),
        y1: cy + Math.sin(a1) * (radius + wob()),
        x2: cx + Math.cos(a2) * (radius + wob()),
        y2: cy + Math.sin(a2) * (radius + wob()),
        w: 1.1
      });
    }
  }

  /* ---------- progressive reveal ---------- */
  function animateCracks(canvas, segments, done) {
    const ctx = canvas.getContext('2d');
    ctx.lineCap = 'round';
    // Shuffle so cracks spread in a natural, non-uniform order.
    for (let i = segments.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [segments[i], segments[j]] = [segments[j], segments[i]];
    }
    const start = performance.now();
    const DURATION = 550; // ms for the full shatter

    function frame(now) {
      const t = Math.min(1, (now - start) / DURATION);
      const count = Math.floor(t * segments.length);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < count; i++) {
        const s = segments[i];
        ctx.strokeStyle = 'rgba(255,255,255,0.88)';
        ctx.lineWidth = s.w;
        ctx.shadowColor = 'rgba(0,0,0,0.55)';
        ctx.shadowBlur = 3;
        ctx.beginPath();
        ctx.moveTo(s.x1, s.y1);
        ctx.lineTo(s.x2, s.y2);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      if (t < 1) requestAnimationFrame(frame);
      else done();
    }
    requestAnimationFrame(frame);
  }

  /* ---------- restore button ---------- */
  function showRestoreButton(shadow, host) {
    const btn = document.createElement('button');
    btn.textContent = '\u{1F605} JUST KIDDING \u2014 click to restore';
    Object.assign(btn.style, {
      position: 'absolute', left: '50%', bottom: '48px',
      transform: 'translateX(-50%)', pointerEvents: 'auto',
      padding: '14px 26px', fontSize: '16px', fontWeight: '800',
      fontFamily: 'system-ui, sans-serif', color: '#fff',
      background: 'linear-gradient(135deg,#ef4444,#b91c1c)',
      border: 'none', borderRadius: '14px', cursor: 'pointer',
      boxShadow: '0 8px 32px rgba(239,68,68,.45)'
    });
    btn.addEventListener('click', () => {
      host.remove();
      window.__crackScreenActive = false;
    });
    shadow.appendChild(btn);
  }

  /* ---------- synthesized shatter sound (Web Audio, no files) ---------- */
  function playShatterSound() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ac = new AC();
      if (ac.state === 'suspended') ac.resume().catch(() => {});

      // Glassy noise burst: filtered noise with a fast decay.
      const dur = 0.55;
      const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * dur), ac.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2.2);
      }
      const noise = ac.createBufferSource();
      noise.buffer = buf;
      const hp = ac.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 1400;
      const ng = ac.createGain(); ng.gain.value = 0.45;
      noise.connect(hp); hp.connect(ng); ng.connect(ac.destination);
      noise.start();

      // Low impact thump underneath.
      const osc = ac.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(130, ac.currentTime);
      osc.frequency.exponentialRampToValueAtTime(38, ac.currentTime + 0.32);
      const og = ac.createGain();
      og.gain.setValueAtTime(0.55, ac.currentTime);
      og.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.36);
      osc.connect(og); og.connect(ac.destination);
      osc.start(); osc.stop(ac.currentTime + 0.4);
    } catch (e) {
      // Audio unavailable — the visual effect still shows.
    }
  }
})();
