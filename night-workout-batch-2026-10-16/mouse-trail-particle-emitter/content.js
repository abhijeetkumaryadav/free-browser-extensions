/* Mouse Trail Particle Emitter — content script.
   Draws a sparkling particle trail on a full-viewport canvas overlay.
   HARD GUARANTEE: the page DOM is never modified — everything lives on one
   canvas element that is removed on stop / Esc. 100% local, no network. */

(() => {
  // Install the message listener only once per page.
  if (window.__mtpeInstalled) return;
  window.__mtpeInstalled = true;

  let canvas = null;      // overlay canvas
  let ctx = null;
  let rafId = 0;          // animation frame id
  let running = false;
  let settings = { style: 'sparkle', color: '#e879f9', intensity: 2 };
  let mouse = { x: -100, y: -100 };
  let particles = [];

  const INTENSITY = { 1: 2, 2: 5, 3: 11 }; // particles spawned per frame

  // ---------- overlay lifecycle ----------
  function createOverlay() {
    canvas = document.createElement('canvas');
    canvas.id = '__mtpe_overlay';
    canvas.style.cssText =
      'position:fixed;inset:0;width:100vw;height:100vh;z-index:2147483647;' +
      'pointer-events:none;margin:0;padding:0;';
    document.documentElement.appendChild(canvas);
    ctx = canvas.getContext('2d');
    fitCanvas();
    window.addEventListener('resize', fitCanvas);
    window.addEventListener('mousemove', trackMouse, { passive: true });
    window.addEventListener('keydown', escListener);
  }

  function fitCanvas() {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function trackMouse(e) { mouse.x = e.clientX; mouse.y = e.clientY; }

  function escListener(e) {
    if (e.key === 'Escape') stopTrail();
  }

  function destroyOverlay() {
    window.removeEventListener('resize', fitCanvas);
    window.removeEventListener('mousemove', trackMouse);
    window.removeEventListener('keydown', escListener);
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    particles = [];
    if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
    canvas = null; ctx = null;
  }

  // ---------- particles ----------
  function rand(a, b) { return a + Math.random() * (b - a); }

  function spawnParticle() {
    const s = settings.style;
    const p = {
      x: mouse.x + rand(-4, 4),
      y: mouse.y + rand(-4, 4),
      life: 0,
      maxLife: rand(28, 60),
      size: rand(2, 6),
      white: Math.random() < 0.35, // mix in white sparkles
    };
    if (s === 'sparkle') {
      p.vx = rand(-1.4, 1.4); p.vy = rand(-1.4, 1.4); p.grav = 0.015;
    } else if (s === 'bubble') {
      p.vx = rand(-1, 1); p.vy = rand(-2.4, -0.8); p.grav = -0.01; p.size = rand(3, 9);
    } else { // ember
      p.vx = rand(-0.8, 0.8); p.vy = rand(-2.8, -1.2); p.grav = -0.03; p.size = rand(1.5, 4);
    }
    particles.push(p);
  }

  function drawSparkle(p, alpha) {
    const r = p.size * (1 - p.life / p.maxLife * 0.5);
    ctx.beginPath();
    ctx.moveTo(p.x - r, p.y); ctx.lineTo(p.x + r, p.y);
    ctx.moveTo(p.x, p.y - r); ctx.lineTo(p.x, p.y + r);
    ctx.strokeStyle = p.color;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }

  function drawBubble(p, alpha) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.globalAlpha = alpha * 0.9;
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 1.4;
    ctx.stroke();
    // tiny highlight
    ctx.beginPath();
    ctx.arc(p.x - p.size * 0.3, p.y - p.size * 0.3, p.size * 0.22, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = alpha;
    ctx.fill();
  }

  function drawEmber(p, alpha) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.globalAlpha = alpha;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  function tick() {
    if (!running) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // spawn new particles at the cursor
    const count = INTENSITY[settings.intensity] || 5;
    if (mouse.x >= 0) {
      for (let i = 0; i < count; i++) spawnParticle();
    }

    // update + draw
    particles = particles.filter(p => p.life < p.maxLife);
    for (const p of particles) {
      p.life++;
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.grav;
      const alpha = 1 - p.life / p.maxLife;
      p.color = p.white ? '#ffffff' : settings.color;
      if (settings.style === 'sparkle') drawSparkle(p, alpha);
      else if (settings.style === 'bubble') drawBubble(p, alpha);
      else drawEmber(p, alpha);
    }
    ctx.globalAlpha = 1;
    rafId = requestAnimationFrame(tick);
  }

  // ---------- commands ----------
  function startTrail(newSettings) {
    if (newSettings) settings = { ...settings, ...newSettings };
    stopTrail(); // tear down any previous run before restarting
    running = true;
    createOverlay();
    rafId = requestAnimationFrame(tick);
  }

  function stopTrail() {
    running = false;
    destroyOverlay();
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.action === 'mtpe:ping') { sendResponse(running); return true; }
    if (msg.action === 'mtpe:start') { startTrail(msg.settings); sendResponse(true); return true; }
    if (msg.action === 'mtpe:stop') { stopTrail(); sendResponse(true); return true; }
    return false;
  });
})();
