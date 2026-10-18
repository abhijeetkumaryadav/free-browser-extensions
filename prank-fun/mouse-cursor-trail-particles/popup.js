/* SparkleTrail popup logic.
 * Injects a self-contained particle-trail function into the active tab via
 * chrome.scripting.executeScript. The injected code is fully self-contained
 * (MV3 CSP forbids eval/new Function) and renders inside a shadow-DOM overlay
 * so page styles never clash with the canvas. */

const DEFAULTS = { enabled: false, theme: 'rainbow', size: 6, density: 4 };
const OVERLAY_ID = 'sparkletrail-overlay';
const MAX_PARTICLES = 300;

// ---------------------------------------------------------------------------
// Injected content function — runs in the page context. Must not reference
// popup scope. `opts` is JSON-serializable.
// ---------------------------------------------------------------------------
function applyTrail(opts) {
  const OVERLAY_ID = 'sparkletrail-overlay';
  const MAX_PARTICLES = 300;
  // Tear down any previous overlay (clean, reversible).
  const old = document.getElementById(OVERLAY_ID);
  if (old) old.remove();
  if (window.__sparkletrail_raf) {
    cancelAnimationFrame(window.__sparkletrail_raf);
    window.__sparkletrail_raf = 0;
  }
  if (window.__sparkletrail_resize) window.removeEventListener('resize', window.__sparkletrail_resize);
  // Remove stale spawn listeners from any previous injection so they never stack.
  if (window.__sparkletrail_move) {
    window.removeEventListener('mousemove', window.__sparkletrail_move);
    window.removeEventListener('touchmove', window.__sparkletrail_touch);
    window.__sparkletrail_move = null;
    window.__sparkletrail_touch = null;
  }
  if (!opts.enabled) return;

  const THEMES = {
    rainbow: ['#f43f5e', '#f97316', '#facc15', '#22c55e', '#22d3ee', '#a78bfa'],
    ocean: ['#0ea5e9', '#22d3ee', '#67e8f9', '#38bdf8', '#a5f3fc'],
    fire: ['#ef4444', '#f97316', '#fbbf24', '#fde68a', '#b91c1c'],
    gold: ['#facc15', '#fde047', '#fbbf24', '#fef9c3', '#eab308']
  };
  const palette = THEMES[opts.theme] || THEMES.rainbow;
  const baseSize = Math.min(14, Math.max(2, Number(opts.size) || 6));
  const density = Math.min(10, Math.max(1, Number(opts.density) || 4));

  // Shadow-DOM overlay: isolated from page styles, pointer-events none.
  const host = document.createElement('div');
  host.id = OVERLAY_ID;
  host.style.cssText =
    'position:fixed;inset:0;z-index:2147483647;pointer-events:none;margin:0;padding:0;';
  const shadow = host.attachShadow({ mode: 'open' });
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;';
  shadow.appendChild(canvas);
  document.documentElement.appendChild(host);

  const ctx = canvas.getContext('2d');
  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.__sparkletrail_resize = resize;
  window.addEventListener('resize', resize);

  const particles = [];
  let colorIdx = 0;

  function spawn(x, y) {
    for (let i = 0; i < density; i++) {
      if (particles.length >= MAX_PARTICLES) particles.shift();
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.4 + Math.random() * 1.6;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.6, // slight upward drift
        life: 1,
        decay: 0.015 + Math.random() * 0.02,
        r: baseSize * (0.4 + Math.random() * 0.8),
        color: palette[colorIdx++ % palette.length]
      });
    }
  }

  window.__sparkletrail_move = (e) => spawn(e.clientX, e.clientY);
  window.__sparkletrail_touch = (e) => {
    const t = e.touches[0];
    if (t) spawn(t.clientX, t.clientY);
  };
  window.addEventListener('mousemove', window.__sparkletrail_move, { passive: true });
  window.addEventListener('touchmove', window.__sparkletrail_touch, { passive: true });

  function frame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy;
      p.vx *= 0.98; p.vy *= 0.98; // drag
      p.life -= p.decay;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    window.__sparkletrail_raf = requestAnimationFrame(frame);
  }
  frame();
}

// ---------------------------------------------------------------------------
// Popup wiring
// ---------------------------------------------------------------------------
const $ = (id) => document.getElementById(id);
const toggle = $('toggle');
const size = $('size'), sizeVal = $('sizeVal');
const density = $('density'), densityVal = $('densityVal');
const chips = Array.from(document.querySelectorAll('#themes .chip'));

async function getSettings() {
  const s = await chrome.storage.local.get(DEFAULTS);
  return { ...DEFAULTS, ...s };
}
async function saveSettings(patch) {
  const next = { ...(await getSettings()), ...patch };
  await chrome.storage.local.set(next);
  return next;
}

async function inject(settings) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id || /^chrome:\/\//.test(tab.url || '')) return;
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: applyTrail,
      args: [settings]
    });
  } catch (e) {
    console.warn('SparkleTrail inject failed:', e);
  }
}

function render(s) {
  toggle.setAttribute('aria-checked', String(!!s.enabled));
  size.value = s.size; sizeVal.textContent = s.size;
  density.value = s.density; densityVal.textContent = s.density;
  chips.forEach((c) => c.classList.toggle('active', c.dataset.theme === s.theme));
}

toggle.addEventListener('click', async () => {
  const next = await saveSettings({ enabled: !(await getSettings()).enabled });
  render(next);
  inject(next);
});

size.addEventListener('input', () => { sizeVal.textContent = size.value; });
density.addEventListener('input', () => { densityVal.textContent = density.value; });
size.addEventListener('change', async () => {
  const next = await saveSettings({ size: Number(size.value) });
  if (next.enabled) inject(next);
});
density.addEventListener('change', async () => {
  const next = await saveSettings({ density: Number(density.value) });
  if (next.enabled) inject(next);
});

chips.forEach((chip) => {
  chip.addEventListener('click', async () => {
    const next = await saveSettings({ theme: chip.dataset.theme });
    render(next);
    if (next.enabled) inject(next);
  });
});

getSettings().then(render);
