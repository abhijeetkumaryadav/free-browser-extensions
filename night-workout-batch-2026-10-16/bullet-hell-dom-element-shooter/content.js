// content.js — Bullet Hell mini game. Draws everything on a fixed full-viewport
// <canvas> overlay; the underlying page DOM is never touched or modified.
(function () {
  'use strict';
  if (window.__bulletHell) return;
  const G = { on: false, raf: 0, canvas: null, ctx: null, diff: 'normal',
              player: null, shots: [], foes: [], foeShots: [], stars: [],
              score: 0, lives: 3, t: 0, mouse: { x: 0, y: 0 } };
  window.__bulletHell = G;

  const TUNING = {
    easy:   { foeRate: 70, foeSpeed: 1.6, foeFire: 140, foeHp: 1 },
    normal: { foeRate: 48, foeSpeed: 2.2, foeFire: 95,  foeHp: 2 },
    hard:   { foeRate: 32, foeSpeed: 2.9, foeFire: 60,  foeHp: 3 }
  };

  function resize() {
    G.canvas.width = innerWidth; G.canvas.height = innerHeight;
    G.player.x = Math.min(G.player.x, G.canvas.width - 40);
    G.player.y = G.canvas.height - 90;
  }

  function makeCanvas() {
    const c = document.createElement('canvas');
    c.style.cssText = 'position:fixed;inset:0;z-index:2147483000;cursor:crosshair;' +
      'background:rgba(8,10,18,0.82);backdrop-filter:blur(2px)';
    document.documentElement.appendChild(c);
    return c;
  }

  function spawnFoe() {
    const T = TUNING[G.diff];
    const w = G.canvas.width;
    G.foes.push({
      x: 30 + Math.random() * (w - 60), y: -40,
      vx: (Math.random() - 0.5) * 2, vy: T.foeSpeed * (0.7 + Math.random() * 0.6),
      hp: T.foeHp, r: 16 + Math.random() * 10, fire: 0, fireRate: T.foeFire,
      hue: 330 + Math.random() * 40
    });
  }

  function update() {
    const T = TUNING[G.diff], W = G.canvas.width, H = G.canvas.height;
    G.t++;
    // player follows mouse (eased)
    G.player.x += (G.mouse.x - G.player.x) * 0.18;
    G.player.y += (G.mouse.y - G.player.y) * 0.18;
    // stars
    for (const s of G.stars) { s.y += s.v; if (s.y > H) { s.y = -2; s.x = Math.random() * W; } }
    // spawn foes
    if (G.t % T.foeRate === 0) spawnFoe();
    // player shots move up
    for (const s of G.shots) s.y -= 9;
    G.shots = G.shots.filter(s => s.y > -10);
    // foes move, bounce off walls, drift down, fire
    for (const f of G.foes) {
      f.x += f.vx; f.y += f.vy;
      if (f.x < f.r || f.x > W - f.r) f.vx *= -1;
      f.fire++;
      if (f.fire >= f.fireRate && f.y > 0 && f.y < H * 0.7) {
        f.fire = 0;
        const dx = G.player.x - f.x, dy = G.player.y - f.y, d = Math.hypot(dx, dy) || 1;
        G.foeShots.push({ x: f.x, y: f.y + f.r, vx: dx / d * 3.2, vy: dy / d * 3.2, r: 5 });
      }
    }
    G.foes = G.foes.filter(f => f.y < H + 60);
    for (const s of G.foeShots) { s.x += s.vx; s.y += s.vy; }
    G.foeShots = G.foeShots.filter(s => s.x > -20 && s.x < W + 20 && s.y > -20 && s.y < H + 20);
    // collisions: shots vs foes
    for (const s of G.shots) {
      for (const f of G.foes) {
        if (Math.hypot(s.x - f.x, s.y - f.y) < f.r + 4) {
          f.hp--; s.dead = true;
          if (f.hp <= 0) { f.dead = true; G.score += 10; }
          break;
        }
      }
    }
    G.shots = G.shots.filter(s => !s.dead);
    G.foes = G.foes.filter(f => !f.dead);
    // collisions: foe shots / foes vs player
    const p = G.player;
    const hit = G.foeShots.some(s => Math.hypot(s.x - p.x, s.y - p.y) < p.r + s.r) ||
                G.foes.some(f => Math.hypot(f.x - p.x, f.y - p.y) < f.r + p.r);
    if (hit && G.t - G.lastHit > 60) {
      G.lastHit = G.t; G.lives--;
      G.foeShots.length = 0; // brief breather
      if (G.lives <= 0) return gameOver();
    }
  }

  function draw() {
    const ctx = G.ctx, W = G.canvas.width, H = G.canvas.height;
    ctx.clearRect(0, 0, W, H);
    // stars
    ctx.fillStyle = '#94a3b8';
    for (const s of G.stars) ctx.fillRect(s.x, s.y, 2, 2);
    // foes (bouncing DOM-element lookalikes)
    for (const f of G.foes) {
      ctx.save();
      ctx.fillStyle = `hsla(${f.hue},80%,60%,0.9)`;
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'center';
      ctx.fillText('<div>', f.x, f.y + 4);
      ctx.restore();
    }
    // shots
    ctx.fillStyle = '#38bdf8';
    for (const s of G.shots) { ctx.fillRect(s.x - 2, s.y - 8, 4, 12); }
    ctx.fillStyle = '#f87171';
    for (const s of G.foeShots) { ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 7); ctx.fill(); }
    // player
    const p = G.player;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = '#22d3ee'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -p.r); ctx.lineTo(p.r * 0.8, p.r * 0.8); ctx.lineTo(0, p.r * 0.35); ctx.lineTo(-p.r * 0.8, p.r * 0.8);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    // HUD
    ctx.fillStyle = '#f4f4f5'; ctx.font = '600 16px system-ui'; ctx.textAlign = 'left';
    ctx.fillText('SCORE ' + G.score, 18, 30);
    ctx.fillStyle = '#f87171';
    ctx.fillText('♥'.repeat(Math.max(G.lives, 0)) || '—', 18, 56);
    ctx.fillStyle = '#a1a1aa'; ctx.font = '12px system-ui';
    ctx.fillText('move: mouse · shoot: click · ESC ends', 18, H - 18);
  }

  function loop() {
    if (!G.on) return;
    update();
    if (!G.on) return; // gameOver may have fired
    draw();
    G.raf = requestAnimationFrame(loop);
  }

  function gameOver() {
    G.on = false; cancelAnimationFrame(G.raf);
    chrome.storage.local.get({ bhHigh: 0 }, (s) => {
      if (G.score > s.bhHigh) chrome.storage.local.set({ bhHigh: G.score });
    });
    const ctx = G.ctx, W = G.canvas.width, H = G.canvas.height;
    ctx.fillStyle = 'rgba(8,10,18,0.7)'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#f4f4f5'; ctx.textAlign = 'center'; ctx.font = '700 34px system-ui';
    ctx.fillText('GAME OVER', W / 2, H / 2 - 10);
    ctx.fillStyle = '#38bdf8'; ctx.font = '600 18px system-ui';
    ctx.fillText('score ' + G.score + ' — press ESC to close', W / 2, H / 2 + 28);
  }

  function onMouse(e) { G.mouse.x = e.clientX; G.mouse.y = e.clientY; }
  function onClick(e) {
    e.preventDefault(); e.stopPropagation();
    G.shots.push({ x: G.player.x, y: G.player.y - 18 });
  }
  function onKey(e) { if (e.key === 'Escape') window.__bulletHellStop(); }

  window.__bulletHellStart = function (diff) {
    window.__bulletHellStop();
    G.diff = TUNING[diff] ? diff : 'normal';
    G.canvas = makeCanvas();
    G.ctx = G.canvas.getContext('2d');
    G.player = { x: innerWidth / 2, y: innerHeight - 90, r: 14 };
    G.mouse = { x: innerWidth / 2, y: innerHeight - 90 };
    G.shots = []; G.foes = []; G.foeShots = [];
    G.score = 0; G.lives = 3; G.t = 0; G.lastHit = -999;
    G.stars = Array.from({ length: 90 }, () => ({
      x: Math.random() * innerWidth, y: Math.random() * innerHeight, v: 0.4 + Math.random() * 1.4
    }));
    G._onResize = resize; G._onMouse = onMouse; G._onClick = onClick; G._onKey = onKey;
    addEventListener('resize', resize);
    addEventListener('mousemove', onMouse);
    G.canvas.addEventListener('mousedown', onClick);
    addEventListener('keydown', onKey, true);
    G.on = true;
    G.raf = requestAnimationFrame(loop);
  };

  window.__bulletHellStop = function () {
    G.on = false; cancelAnimationFrame(G.raf);
    if (G._onResize) {
      removeEventListener('resize', G._onResize);
      removeEventListener('mousemove', G._onMouse);
      removeEventListener('keydown', G._onKey, true);
      G._onResize = null;
    }
    if (G.canvas && G.canvas.parentNode) G.canvas.parentNode.removeChild(G.canvas);
    G.canvas = null;
  };
})();
