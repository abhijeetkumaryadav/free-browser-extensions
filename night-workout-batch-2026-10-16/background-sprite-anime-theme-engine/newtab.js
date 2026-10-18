/* AnimeTab theme engine — five fully procedural animated backgrounds.
 * Every sprite (petals, stars, clouds, fireflies, bubbles) is drawn on
 * canvas with plain 2D primitives. No images, no network, no tracking. */
'use strict';

// ---------- helpers ----------
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const TAU = Math.PI * 2;

function vGrad(c, w, h, stops) {
  const g = c.createLinearGradient(0, 0, 0, h);
  for (const [o, col] of stops) g.addColorStop(o, col);
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
}

// ---------- themes ----------
// Each theme: { name, desc, swatch:[c1,c2], accent, count, bg(c,w,h,t), make(w,h), step(p,w,h,dt,t), draw(c,p,t) }
// step is invoked as th.step.call(th, ...) so this.make works for respawns.
const THEMES = {
  sakura: {
    name: 'Sakura Drift', desc: 'Falling cherry petals',
    swatch: ['#ffd1e3', '#ff9ec7'], accent: '#ff9ec7', count: 90,
    bg(c, w, h) {
      vGrad(c, w, h, [[0, '#ffe9f2'], [0.6, '#ffd7e8'], [1, '#ffc4dd']]);
      // soft sun glow
      const g = c.createRadialGradient(w * 0.78, h * 0.2, 10, w * 0.78, h * 0.2, w * 0.35);
      g.addColorStop(0, 'rgba(255,255,255,.55)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      // distant hill silhouette
      c.fillStyle = 'rgba(230,150,190,.35)';
      c.beginPath();
      c.ellipse(w * 0.2, h * 1.02, w * 0.55, h * 0.22, 0, Math.PI, TAU);
      c.fill();
    },
    make(w, h) {
      return {
        x: rand(0, w), y: rand(-h * 0.2, h),
        s: rand(6, 15), a: rand(0, TAU), spin: rand(-0.04, 0.04),
        vy: rand(0.5, 1.4), ph: rand(0, TAU),
        col: pick(['#ffc2d9', '#ffb3d1', '#ff9ec7', '#ffd6e6', '#ff8fbf']),
      };
    },
    step(p, w, h, dt) {
      p.ph += 0.025 * dt; p.a += p.spin * dt;
      p.y += p.vy * dt; p.x += Math.sin(p.ph) * 0.7 * dt;
      if (p.y > h + 24) Object.assign(p, this.make(w, h), { y: -24 });
    },
    draw(c, p) {
      c.save();
      c.translate(p.x, p.y);
      c.rotate(p.a);
      c.scale(1, 0.62 + 0.28 * Math.abs(Math.sin(p.ph))); // flutter
      c.fillStyle = p.col;
      c.beginPath();
      c.ellipse(0, 0, p.s, p.s * 0.7, 0, 0, TAU);
      c.fill();
      c.strokeStyle = 'rgba(200,90,140,.45)';
      c.lineWidth = 1;
      c.beginPath(); c.moveTo(-p.s, 0); c.lineTo(p.s, 0); c.stroke();
      c.restore();
    },
  },

  starfall: {
    name: 'Starfall Night', desc: 'Twinkling stars & meteors',
    swatch: ['#1b2a4a', '#7dd3fc'], accent: '#7dd3fc', count: 160,
    bg(c, w, h) {
      vGrad(c, w, h, [[0, '#070b1d'], [0.55, '#101a38'], [1, '#1b2a4a']]);
      // moon + glow
      const mx = w * 0.8, my = h * 0.2, mr = Math.min(w, h) * 0.055;
      const g = c.createRadialGradient(mx, my, mr * 0.4, mx, my, mr * 4);
      g.addColorStop(0, 'rgba(220,235,255,.35)');
      g.addColorStop(1, 'rgba(220,235,255,0)');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      c.fillStyle = '#e8f1ff';
      c.beginPath(); c.arc(mx, my, mr, 0, TAU); c.fill();
      c.fillStyle = 'rgba(160,180,210,.5)';
      c.beginPath(); c.arc(mx - mr * 0.3, my - mr * 0.1, mr * 0.18, 0, TAU); c.fill();
      c.beginPath(); c.arc(mx + mr * 0.25, my + mr * 0.3, mr * 0.12, 0, TAU); c.fill();
      // mountain silhouette
      c.fillStyle = '#0a0f24';
      c.beginPath();
      c.moveTo(0, h);
      c.lineTo(w * 0.18, h * 0.72); c.lineTo(w * 0.34, h);
      c.lineTo(w * 0.55, h * 0.78); c.lineTo(w * 0.72, h);
      c.lineTo(w * 0.9, h * 0.7); c.lineTo(w, h);
      c.closePath(); c.fill();
    },
    make(w, h) {
      return { x: rand(0, w), y: rand(0, h * 0.85), r: rand(0.6, 2.2), ph: rand(0, TAU), sp: rand(0.5, 2) };
    },
    step(p) { /* stars are static; twinkle handled in draw */ },
    draw(c, p, t) {
      const tw = 0.35 + 0.65 * Math.abs(Math.sin(t * 0.001 * p.sp + p.ph));
      c.fillStyle = `rgba(230,240,255,${tw.toFixed(3)})`;
      c.beginPath(); c.arc(p.x, p.y, p.r, 0, TAU); c.fill();
    },
    meteors: [],
    extra(c, w, h, dt) {
      // occasional shooting star
      if (Math.random() < 0.006 * dt && this.meteors.length < 3) {
        this.meteors.push({ x: rand(w * 0.3, w), y: rand(0, h * 0.3), vx: -rand(6, 10), vy: rand(3, 5), life: 1 });
      }
      for (let i = this.meteors.length - 1; i >= 0; i--) {
        const m = this.meteors[i];
        m.x += m.vx * dt; m.y += m.vy * dt; m.life -= 0.02 * dt;
        if (m.life <= 0) { this.meteors.splice(i, 1); continue; }
        const g = c.createLinearGradient(m.x, m.y, m.x - m.vx * 12, m.y - m.vy * 12);
        g.addColorStop(0, `rgba(255,255,255,${(0.9 * m.life).toFixed(3)})`);
        g.addColorStop(1, 'rgba(255,255,255,0)');
        c.strokeStyle = g; c.lineWidth = 2; c.lineCap = 'round';
        c.beginPath(); c.moveTo(m.x, m.y); c.lineTo(m.x - m.vx * 12, m.y - m.vy * 12); c.stroke();
      }
    },
  },

  clouds: {
    name: 'Cloud Voyage', desc: 'Drifting soft clouds',
    swatch: ['#aee2ff', '#ffffff'], accent: '#7dd3fc', count: 12,
    bg(c, w, h) {
      vGrad(c, w, h, [[0, '#8ecdf7'], [0.6, '#c9e9ff'], [1, '#eef9ff']]);
      const g = c.createRadialGradient(w * 0.2, h * 0.18, 10, w * 0.2, h * 0.18, w * 0.2);
      g.addColorStop(0, 'rgba(255,255,180,.8)');
      g.addColorStop(1, 'rgba(255,255,180,0)');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
    },
    make(w, h) {
      const s = rand(0.6, 1.8);
      const puffs = [];
      const n = 5 + ((Math.random() * 4) | 0);
      for (let i = 0; i < n; i++) puffs.push({ ox: rand(-70, 70), oy: rand(-22, 22), r: rand(24, 52) });
      return { x: rand(-200, w), y: rand(h * 0.05, h * 0.6), s, vx: rand(0.15, 0.5) * (s > 1.2 ? 1 : 0.6), puffs };
    },
    step(p, w, h, dt) {
      p.x += p.vx * dt;
      if (p.x - 200 * p.s > w) Object.assign(p, this.make(w, h), { x: -220 * p.s });
    },
    draw(c, p) {
      c.save();
      c.translate(p.x, p.y);
      c.scale(p.s, p.s);
      for (const q of p.puffs) {
        const g = c.createRadialGradient(q.ox, q.oy, q.r * 0.2, q.ox, q.oy, q.r);
        g.addColorStop(0, 'rgba(255,255,255,.92)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = g;
        c.beginPath(); c.arc(q.ox, q.oy, q.r, 0, TAU); c.fill();
      }
      c.restore();
    },
  },

  fireflies: {
    name: 'Firefly Meadow', desc: 'Glowing fireflies at dusk',
    swatch: ['#123b33', '#bef264'], accent: '#bef264', count: 70,
    bg(c, w, h) {
      vGrad(c, w, h, [[0, '#081a17'], [0.6, '#0d2b25'], [1, '#123b33']]);
      // grass silhouette
      c.fillStyle = '#06120f';
      c.beginPath(); c.moveTo(0, h);
      for (let x = 0; x <= w; x += 24) {
        const bh = 26 + 34 * Math.abs(Math.sin(x * 0.05) * Math.cos(x * 0.013));
        c.lineTo(x, h - bh);
        c.lineTo(x + 12, h);
      }
      c.lineTo(w, h); c.closePath(); c.fill();
    },
    make(w, h) {
      return {
        bx: rand(0, w), by: rand(h * 0.25, h * 0.9),
        ph: rand(0, TAU), sp: rand(0.4, 1.2), amp: rand(14, 46),
        r: rand(1.6, 3.2), blink: rand(0, TAU), bs: rand(0.8, 2.2),
      };
    },
    step(p, _w, _h, dt, t) {
      p.ph += 0.008 * dt * p.sp;
      p.blink += 0.02 * dt * p.bs;
      p.x = p.bx + Math.sin(p.ph) * p.amp;
      p.y = p.by + Math.cos(p.ph * 0.7) * p.amp * 0.6;
      p.glow = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(p.blink));
    },
    draw(c, p) {
      const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 6);
      g.addColorStop(0, `rgba(220,255,150,${(0.85 * p.glow).toFixed(3)})`);
      g.addColorStop(0.4, `rgba(190,242,100,${(0.35 * p.glow).toFixed(3)})`);
      g.addColorStop(1, 'rgba(190,242,100,0)');
      c.fillStyle = g;
      c.beginPath(); c.arc(p.x, p.y, p.r * 6, 0, TAU); c.fill();
      c.fillStyle = '#f4ffd6';
      c.beginPath(); c.arc(p.x, p.y, p.r * 0.8, 0, TAU); c.fill();
    },
  },

  aqua: {
    name: 'Aqua Bubbles', desc: 'Rising ocean bubbles',
    swatch: ['#06283d', '#38bdf8'], accent: '#38bdf8', count: 80,
    bg(c, w, h, t) {
      vGrad(c, w, h, [[0, '#0b4f6c'], [0.6, '#0a3a52'], [1, '#06283d']]);
      // rotating light rays from the surface
      c.save();
      c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        const a = Math.sin(t * 0.0002 + i * 2.1) * 0.35 + (i - 1) * 0.5;
        const g = c.createLinearGradient(w / 2, 0, w / 2 + Math.tan(a) * h, h);
        g.addColorStop(0, 'rgba(140,210,255,.14)');
        g.addColorStop(1, 'rgba(140,210,255,0)');
        c.fillStyle = g;
        c.beginPath();
        c.moveTo(w * (0.3 + i * 0.2), 0);
        c.lineTo(w * (0.38 + i * 0.2), 0);
        c.lineTo(w * (0.38 + i * 0.2) + Math.tan(a) * h, h);
        c.lineTo(w * (0.3 + i * 0.2) + Math.tan(a) * h, h);
        c.closePath(); c.fill();
      }
      c.restore();
      // sandy floor
      const g2 = c.createRadialGradient(w / 2, h * 1.15, 10, w / 2, h * 1.15, w * 0.7);
      g2.addColorStop(0, 'rgba(190,160,110,.5)');
      g2.addColorStop(1, 'rgba(190,160,110,0)');
      c.fillStyle = g2;
      c.beginPath(); c.ellipse(w / 2, h * 1.08, w * 0.7, h * 0.2, 0, Math.PI, TAU); c.fill();
    },
    make(w, h) {
      return { x: rand(0, w), y: rand(0, h), r: rand(2, 9), vy: rand(0.4, 1.3), ph: rand(0, TAU) };
    },
    step(p, w, h, dt) {
      p.ph += 0.03 * dt;
      p.y -= p.vy * dt;
      p.x += Math.sin(p.ph) * 0.5 * dt;
      if (p.y < -20) Object.assign(p, this.make(w, h), { y: h + 20 });
    },
    draw(c, p) {
      c.strokeStyle = 'rgba(180,230,255,.55)';
      c.lineWidth = 1.5;
      c.beginPath(); c.arc(p.x, p.y, p.r, 0, TAU); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,.8)';
      c.beginPath(); c.arc(p.x, p.y, p.r, -2.4, -1.4); c.stroke();
    },
  },
};

// ---------- engine ----------
const canvas = document.getElementById('bg');
const ctx = canvas.getContext('2d');
let W = 0, H = 0;
const DPR = Math.min(window.devicePixelRatio || 1, 2);
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let themeKey = 'sakura';
let density = 1;
let particles = [];

function resize() {
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = Math.round(W * DPR);
  canvas.height = Math.round(H * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  buildParticles();
}

function buildParticles() {
  const th = THEMES[themeKey];
  const n = Math.round(th.count * density);
  particles = [];
  for (let i = 0; i < n; i++) {
    const p = th.make(W, H);
    // pre-scatter so the first frame is already alive
    if (th === THEMES.sakura || th === THEMES.aqua) p.y = rand(0, H);
    if (th.step) for (let k = 0; k < 60; k++) th.step.call(th, p, W, H, 1, 0);
    particles.push(p);
  }
}

function frame(t, dt) {
  const th = THEMES[themeKey];
  th.bg(ctx, W, H, t);
  if (th.extra) th.extra.call(th, ctx, W, H, dt);
  for (const p of particles) {
    if (th.step) th.step.call(th, p, W, H, dt, t);
    th.draw(ctx, p, t);
  }
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(3, (now - last) / 16.667); // ~60fps units
  last = now;
  frame(now, dt);
  requestAnimationFrame(loop);
}

// ---------- clock ----------
function tickClock() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  document.getElementById('clock').textContent = `${hh}:${mm}`;
  document.getElementById('date').textContent =
    d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const h = d.getHours();
  const g = h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  document.getElementById('greet').textContent = `${g} — pick a mood below`;
}

// ---------- UI ----------
function buildDock() {
  const wrap = document.getElementById('themes');
  wrap.innerHTML = '';
  for (const [key, th] of Object.entries(THEMES)) {
    const b = document.createElement('button');
    b.className = 'theme-btn' + (key === themeKey ? ' active' : '');
    b.setAttribute('role', 'tab');
    b.style.setProperty('--s1', th.swatch[0]);
    b.style.setProperty('--s2', th.swatch[1]);
    b.style.setProperty('--sw', th.accent);
    b.title = th.desc;
    b.innerHTML = `<span class="swatch"></span><span>${th.name}</span>`;
    b.addEventListener('click', () => setTheme(key));
    wrap.appendChild(b);
  }
}

async function setTheme(key) {
  themeKey = key;
  try { await chrome.storage.local.set({ theme: key }); } catch (_) { /* ignore */ }
  buildParticles();
  buildDock();
}

// ---------- init ----------
(async function init() {
  try {
    const s = await chrome.storage.local.get({ theme: 'sakura', density: 1 });
    if (THEMES[s.theme]) themeKey = s.theme;
    density = Number(s.density) || 1;
  } catch (_) { /* defaults */ }
  document.getElementById('density').value = String(density);

  document.getElementById('density').addEventListener('change', async (e) => {
    density = Number(e.target.value);
    try { await chrome.storage.local.set({ density }); } catch (_) { /* ignore */ }
    buildParticles();
  });

  buildDock();
  tickClock();
  setInterval(tickClock, 1000);
  resize();
  window.addEventListener('resize', resize);
  if (reduced) {
    frame(performance.now(), 1); // single static frame
  } else {
    requestAnimationFrame(loop);
  }
})();
