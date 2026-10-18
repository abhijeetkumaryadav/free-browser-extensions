// Cursor Fireworks — content script.
// Canvas overlay emitting cursor-trailing particles. Pure visual fun:
// pointer-events pass through, no tracking, no network, stops on demand.

// Guard against double-injection on re-execute.
if (!window.__cursorFireworks) {
  window.__cursorFireworks = createFireworks();
}

function createFireworks() {
  const state = { running: false, style: 'sparkle', density: 5, raf: 0 };
  let canvas = null, ctx = null;
  const particles = [];
  let mx = -9999, my = -9999; // last mouse position

  // --- style presets ---
  const STYLES = {
    sparkle: { colors: ['#ffd6e9', '#f472b6', '#fff', '#fbcfe8'], size: [1, 3], gravity: 0.02, life: [30, 60], shape: 'star' },
    embers:  { colors: ['#ffb347', '#ff6b35', '#ffd166', '#ff8c42'], size: [1, 4], gravity: -0.015, life: [40, 80], shape: 'circle' },
    bubbles: { colors: ['#a5f3fc', '#67e8f9', '#e0f2fe', '#bae6fd'], size: [2, 6], gravity: -0.03, life: [50, 90], shape: 'bubble' }
  };

  function ensureCanvas() {
    if (canvas) return;
    canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:2147483647;';
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    document.documentElement.appendChild(canvas);
    ctx = canvas.getContext('2d');
    window.addEventListener('resize', () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    });
  }

  function spawn(x, y) {
    const s = STYLES[state.style] || STYLES.sparkle;
    const n = state.density; // 1..10 particles per frame
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2;
      const sp = 0.5 + Math.random() * 2;
      particles.push({
        x, y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - 0.5,
        life: s.life[0] + Math.random() * (s.life[1] - s.life[0]),
        age: 0,
        size: s.size[0] + Math.random() * (s.size[1] - s.size[0]),
        color: s.colors[(Math.random() * s.colors.length) | 0],
        gravity: s.gravity,
        shape: s.shape
      });
    }
  }

  function draw(p) {
    const t = 1 - p.age / p.life; // fade factor
    ctx.globalAlpha = Math.max(0, t);
    if (p.shape === 'bubble') {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.stroke();
    } else if (p.shape === 'star') {
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      ctx.globalAlpha = Math.max(0, t * 0.5);
      ctx.fillRect(p.x - p.size, p.y - 0.5, p.size * 2, 1);
      ctx.fillRect(p.x - 0.5, p.y - p.size, 1, p.size * 2);
    } else {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function tick() {
    if (!state.running) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (mx >= 0 && document.visibilityState === 'visible') spawn(mx, my);
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.age++;
      if (p.age >= p.life) { particles.splice(i, 1); continue; }
      p.vy += p.gravity;
      p.x += p.vx; p.y += p.vy;
      draw(p);
    }
    state.raf = requestAnimationFrame(tick);
  }

  function onMove(e) { mx = e.clientX; my = e.clientY; }
  function onLeave() { mx = -9999; my = -9999; }

  function start(style, density) {
    ensureCanvas();
    if (style) state.style = style;
    if (density) state.density = density;
    if (state.running) return;
    state.running = true;
    window.addEventListener('mousemove', onMove, { passive: true });
    document.documentElement.addEventListener('mouseleave', onLeave);
    state.raf = requestAnimationFrame(tick);
  }

  function stop() {
    state.running = false;
    cancelAnimationFrame(state.raf);
    window.removeEventListener('mousemove', onMove);
    document.documentElement.removeEventListener('mouseleave', onLeave);
    particles.length = 0;
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  chrome.runtime.onMessage.addListener((msg, _s, sendResponse) => {
    if (msg.type === 'fw-start') { start(msg.style, msg.density); sendResponse({ ok: true }); }
    else if (msg.type === 'fw-stop') { stop(); sendResponse({ ok: true }); }
    else if (msg.type === 'fw-style') { state.style = msg.style; sendResponse({ ok: true }); }
    else if (msg.type === 'fw-density') { state.density = msg.density; sendResponse({ ok: true }); }
    else if (msg.type === 'fw-ping') { sendResponse({ running: state.running }); }
    return true;
  });

  return { start, stop };
}
