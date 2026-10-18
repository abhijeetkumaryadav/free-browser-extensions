/* Paint Splatter — content script. A playful art toy.
 * Creates a full-page canvas overlay where the user splatters paint.
 * The underlying page DOM is never modified; one message removes everything.
 * Guarded against double injection. */
(() => {
  'use strict';
  if (window.__paintSplatterInstalled) return;
  window.__paintSplatterInstalled = true;

  const NS = 'paint-splatter-overlay';
  let canvas = null, ctx = null, painting = false, active = false;
  let color = '#f472b6', size = 24, spread = 14;

  // Seeded-free randomness is fine: purely decorative paint.
  function rand(min, max) { return min + Math.random() * (max - min); }

  function ensureCanvas() {
    if (canvas) return;
    canvas = document.createElement('canvas');
    canvas.id = NS;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.cssText =
      'position:fixed;inset:0;width:100vw;height:100vh;z-index:2147483646;' +
      'pointer-events:auto;cursor:crosshair;touch-action:none;';
    ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    canvas.addEventListener('pointerdown', (e) => { painting = true; splat(e.clientX, e.clientY); });
    window.addEventListener('pointermove', (e) => { if (painting) splat(e.clientX, e.clientY); });
    window.addEventListener('pointerup', () => { painting = false; });
    document.documentElement.appendChild(canvas);
  }

  // Draw one splat: a main blob plus satellite droplets.
  function splat(x, y) {
    if (!ctx) return;
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, size / 2, 0, Math.PI * 2);
    ctx.fill();
    const drops = Math.floor(spread / 4);
    for (let i = 0; i < drops; i++) {
      const a = rand(0, Math.PI * 2);
      const r = rand(size / 2, size / 2 + spread);
      const rad = rand(1, Math.max(2, size / 8));
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, rad, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function onKey(e) {
    if (e.key === 'Escape') stop();
  }

  function stop() {
    active = false;
    painting = false;
    if (canvas) canvas.style.pointerEvents = 'none';
    window.removeEventListener('keydown', onKey);
  }

  function clear() {
    if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
    canvas = null; ctx = null;
    stop();
  }

  async function start() {
    try {
      const { paintSettings } = await chrome.storage.local.get('paintSettings');
      if (paintSettings) {
        color = paintSettings.color || color;
        size = paintSettings.size || size;
        spread = paintSettings.spread || spread;
      }
    } catch (e) { /* storage unavailable: keep defaults */ }
    ensureCanvas();
    active = true;
    painting = false;
    canvas.style.pointerEvents = 'auto';
    window.addEventListener('keydown', onKey);
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'PAINT_START') start();
    if (msg.type === 'PAINT_CLEAR') clear();
  });
})();
