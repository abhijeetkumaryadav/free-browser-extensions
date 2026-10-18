/* Screen Crack Prank — content script (injected on demand via chrome.scripting).
 * Draws a fake cracked-screen effect on a transparent, click-through canvas
 * overlay. The page DOM is never touched; Esc or the exit function removes it.
 */
(() => {
  'use strict';

  // Guard against double-injection.
  if (window.__crackPrankActive) return;
  window.__crackPrankActive = true;

  /* ------------------------------ overlay canvas ------------------------------ */
  const canvas = document.createElement('canvas');
  canvas.id = '__crackPrankCanvas';
  canvas.setAttribute('style', [
    'position:fixed', 'inset:0', 'z-index:2147483647',
    'pointer-events:none' // click-through: the page stays fully usable
  ].join(';'));
  document.documentElement.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  function fit() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  fit();

  /* ------------------------------ crack drawing ------------------------------ */
  // Draw a jagged crack line from (x,y) along angle, spawning thinner branches.
  function crackLine(g, x, y, angle, length, width, depth) {
    g.strokeStyle = 'rgba(232,238,252,' + (depth === 0 ? 0.9 : 0.65) + ')';
    g.lineWidth = width;
    g.shadowColor = 'rgba(255,255,255,0.35)';
    g.shadowBlur = 2;
    g.beginPath();
    g.moveTo(x, y);
    const segs = 7 + ((Math.random() * 8) | 0);
    const step = length / segs;
    let cx = x, cy = y, a = angle;
    for (let s = 0; s < segs; s++) {
      a += (Math.random() - 0.5) * 0.6;
      cx += Math.cos(a) * step;
      cy += Math.sin(a) * step;
      g.lineTo(cx, cy);
      // Branch off thinner cracks from the middle segments.
      if (depth < 2 && s > 0 && s < segs - 1 && Math.random() < 0.3) {
        const dir = Math.random() < 0.5 ? 1 : -1;
        crackLine(g, cx, cy, a + dir * (0.5 + Math.random() * 0.7),
          length * 0.28, Math.max(0.6, width * 0.5), depth + 1);
      }
    }
    g.stroke();
    g.shadowBlur = 0;
  }

  function drawCracks() {
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Impact point: somewhere near the middle of the screen.
    const ix = W * (0.35 + Math.random() * 0.3);
    const iy = H * (0.35 + Math.random() * 0.3);
    const reach = Math.min(W, H);

    // Impact "chip": small bright splintered spot at the center.
    const chip = ctx.createRadialGradient(ix, iy, 0, ix, iy, 14);
    chip.addColorStop(0, 'rgba(255,255,255,0.95)');
    chip.addColorStop(0.4, 'rgba(230,236,250,0.7)');
    chip.addColorStop(1, 'rgba(230,236,250,0)');
    ctx.fillStyle = chip;
    ctx.beginPath();
    ctx.arc(ix, iy, 14, 0, Math.PI * 2);
    ctx.fill();

    // Concentric fracture rings around the impact.
    const rings = 2 + ((Math.random() * 2) | 0);
    for (let r = 1; r <= rings; r++) {
      const radius = r * (16 + Math.random() * 14);
      ctx.strokeStyle = 'rgba(232,238,252,0.5)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      // Broken ring: draw in arcs with gaps so it looks fractured.
      for (let arc = 0; arc < 5; arc++) {
        const start = (arc / 5) * Math.PI * 2 + Math.random() * 0.4;
        const end = start + Math.PI * 2 / 5 * (0.5 + Math.random() * 0.5);
        ctx.moveTo(ix + Math.cos(start) * radius, iy + Math.sin(start) * radius);
        ctx.arc(ix, iy, radius, start, end);
      }
      ctx.stroke();
    }

    // Radial cracks shooting outward from the impact.
    const n = 9 + ((Math.random() * 5) | 0);
    for (let i = 0; i < n; i++) {
      const angle = (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const len = reach * (0.25 + Math.random() * 0.5);
      crackLine(ctx, ix, iy, angle, len, 2.2, 0);
    }

    // A few long hairline cracks across the screen for realism.
    for (let i = 0; i < 3; i++) {
      const sx = Math.random() * W, sy = Math.random() * H;
      const ang = Math.random() * Math.PI * 2;
      crackLine(ctx, sx, sy, ang, reach * (0.3 + Math.random() * 0.3), 1.1, 1);
    }
  }

  drawCracks();

  /* ------------------------------ teardown ------------------------------ */
  function onResize() { fit(); drawCracks(); }
  function onKeyDown(e) {
    if (e.key === 'Escape') exit();
  }
  window.addEventListener('resize', onResize);
  document.addEventListener('keydown', onKeyDown, true);

  function exit() {
    window.removeEventListener('resize', onResize);
    document.removeEventListener('keydown', onKeyDown, true);
    canvas.remove();
    window.__crackPrankActive = false;
    window.__crackPrankExit = null;
  }
  window.__crackPrankExit = exit;
})();
