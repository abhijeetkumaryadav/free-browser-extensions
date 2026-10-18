/* OrbitBox sandbox — hand-rolled 2D physics toy.
 * No libraries, no network. Everything runs on this page.
 *
 * Physics model:
 * - Semi-implicit Euler integration at a fixed 120 Hz timestep.
 * - Uniform gravity (px/s^2), adjustable from the HUD.
 * - Walls + floor bounce with a restitution ("bounciness") slider.
 * - Ball-ball elastic collisions (equal mass) resolved along the
 *   contact normal, then positional de-penetration so balls don't sink.
 * - Drag-to-fling: release velocity is sampled from pointer movement.
 */
'use strict';

const canvas = document.getElementById('world');
const ctx = canvas.getContext('2d');

const DEFAULTS = { ballSize: 16, gravity: 1200, trails: true };
let settings = { ...DEFAULTS };
let bounciness = 0.82;
let paused = false;
let showTrails = true;

const balls = [];
const MAX_BALLS = 300;
const STEP = 1 / 120; // fixed physics timestep (s)

// A small palette of orange-family hues; accent stays orange.
const PALETTE = ['#f97316', '#fb923c', '#fbbf24', '#f43f5e', '#ef4444'];

function resize() {
  canvas.width = Math.floor(window.innerWidth * devicePixelRatio);
  canvas.height = Math.floor(window.innerHeight * devicePixelRatio);
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
}
window.addEventListener('resize', resize);
resize();

function makeBall(x, y, vx, vy, r) {
  return {
    x, y, vx, vy, r,
    color: PALETTE[(Math.random() * PALETTE.length) | 0],
  };
}

// --- Physics step ------------------------------------------------------

function step(dt, w, h) {
  const g = settings.gravity;

  // Integrate.
  for (const b of balls) {
    b.vy += g * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    // Walls and floor/ceiling with restitution.
    if (b.x - b.r < 0) { b.x = b.r; b.vx = -b.vx * bounciness; }
    else if (b.x + b.r > w) { b.x = w - b.r; b.vx = -b.vx * bounciness; }
    if (b.y - b.r < 0) { b.y = b.r; b.vy = -b.vy * bounciness; }
    else if (b.y + b.r > h) {
      b.y = h - b.r;
      b.vy = -b.vy * bounciness;
      // Rolling friction-ish damping on hard landings keeps the toy lively.
      b.vx *= 0.995;
      if (Math.abs(b.vy) < 24 && g > 0) b.vy = 0; // rest on floor
    }
  }

  // Pairwise elastic collisions (equal mass): exchange normal velocity
  // components scaled by bounciness, then push apart to avoid overlap.
  for (let i = 0; i < balls.length; i++) {
    for (let j = i + 1; j < balls.length; j++) {
      const a = balls[i], b = balls[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      const minDist = a.r + b.r;
      if (dist === 0 || dist >= minDist) continue;
      const nx = dx / dist, ny = dy / dist;

      // Positional correction (split the overlap evenly).
      const overlap = minDist - dist;
      a.x -= (nx * overlap) / 2; a.y -= (ny * overlap) / 2;
      b.x += (nx * overlap) / 2; b.y += (ny * overlap) / 2;

      // Relative velocity along the normal; only collide when approaching.
      const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (rel >= 0) continue;
      const impulse = -(1 + bounciness) * rel / 2;
      a.vx -= impulse * nx; a.vy -= impulse * ny;
      b.vx += impulse * nx; b.vy += impulse * ny;
    }
  }
}

// --- Rendering ---------------------------------------------------------

function draw(w, h) {
  if (showTrails) {
    // Translucent clear leaves fading trails behind moving balls.
    ctx.fillStyle = 'rgba(11, 13, 18, 0.22)';
    ctx.fillRect(0, 0, w, h);
  } else {
    ctx.clearRect(0, 0, w, h);
  }
  for (const b of balls) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fillStyle = b.color;
    ctx.fill();
    // Subtle top-left gloss for a rounded, tactile look.
    const gx = b.x - b.r * 0.35, gy = b.y - b.r * 0.35;
    const gloss = ctx.createRadialGradient(gx, gy, 0, gx, gy, b.r * 0.7);
    gloss.addColorStop(0, 'rgba(255,255,255,0.5)');
    gloss.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gloss;
    ctx.fill();
  }
}

// --- Input: click to drop, drag to fling -------------------------------

let drag = null; // { x, y, px, py, t, vx, vy }

function pointerPos(e) {
  const r = canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

canvas.addEventListener('pointerdown', (e) => {
  const p = pointerPos(e);
  drag = { x: p.x, y: p.y, px: p.x, py: p.y, t: performance.now(), vx: 0, vy: 0 };
  canvas.setPointerCapture(e.pointerId);
});

canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const p = pointerPos(e);
  const now = performance.now();
  const dt = Math.max(1, now - drag.t) / 1000;
  // Sample instantaneous drag velocity, smoothed.
  drag.vx = 0.7 * drag.vx + 0.3 * ((p.x - drag.px) / dt);
  drag.vy = 0.7 * drag.vy + 0.3 * ((p.y - drag.py) / dt);
  drag.px = p.x; drag.py = p.y; drag.t = now;
  drag.x = p.x; drag.y = p.y;
});

canvas.addEventListener('pointerup', (e) => {
  if (!drag) return;
  const speed = Math.hypot(drag.vx, drag.vy);
  // Treat a near-stationary click as a gentle drop; a fast drag flings.
  const v = speed < 80 ? { x: (Math.random() - 0.5) * 60, y: -40 } : { x: drag.vx, y: drag.vy };
  if (balls.length >= MAX_BALLS) balls.shift(); // cap memory
  balls.push(makeBall(drag.x, drag.y, v.x, v.y, settings.ballSize));
  document.getElementById('count').textContent = balls.length;
  drag = null;
});

canvas.addEventListener('pointercancel', () => { drag = null; });

// --- HUD wiring --------------------------------------------------------

chrome.storage.local.get(DEFAULTS, (saved) => {
  settings = { ballSize: saved.ballSize, gravity: saved.gravity, trails: saved.trails };
  showTrails = saved.trails;
  const g = document.getElementById('gravity');
  g.value = saved.gravity;
  document.getElementById('gravityVal').textContent = saved.gravity;
  document.getElementById('trails').checked = saved.trails;
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
});

document.getElementById('gravity').addEventListener('input', (e) => {
  settings.gravity = Number(e.target.value);
  document.getElementById('gravityVal').textContent = e.target.value;
  chrome.storage.local.set({ gravity: settings.gravity });
});

document.getElementById('bounce').addEventListener('input', (e) => {
  bounciness = Number(e.target.value) / 100;
  document.getElementById('bounceVal').textContent = e.target.value + '%';
});

document.getElementById('trails').addEventListener('change', (e) => {
  showTrails = e.target.checked;
  chrome.storage.local.set({ trails: showTrails });
  if (!showTrails) ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
});

const pauseBtn = document.getElementById('pause');
pauseBtn.addEventListener('click', () => {
  paused = !paused;
  pauseBtn.querySelector('span').textContent = paused ? 'Resume' : 'Pause';
});

document.getElementById('clear').addEventListener('click', () => {
  balls.length = 0;
  document.getElementById('count').textContent = '0';
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
});

// --- Main loop: fixed-timestep accumulator -----------------------------

let last = performance.now();
let acc = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); // clamp tab-switch gaps
  last = now;
  if (!paused) {
    acc += dt;
    const w = window.innerWidth, h = window.innerHeight;
    while (acc >= STEP) { step(STEP, w, h); acc -= STEP; }
    draw(w, h);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
