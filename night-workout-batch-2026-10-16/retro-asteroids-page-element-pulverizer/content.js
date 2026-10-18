'use strict';
/* Retro Asteroids — harmless page overlay game.
 * HONEST SCOPE: draws everything on ONE fixed-position canvas overlay.
 * The page DOM is NEVER modified (no element is read, moved, or removed).
 * Esc (or the popup "Remove overlay") tears down the canvas, listeners,
 * and animation frame — leaving the page exactly as it was. */

(() => {
  if (window.__asteroidsOverlayLoaded) return;   // boot-once guard
  window.__asteroidsOverlayLoaded = true;

  const NS = '__asteroidsOverlay';
  let canvas = null, ctx = null, raf = 0;
  let game = null;

  /* ---------- message API ---------- */
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'ASTEROIDS_START') start();
    if (msg.type === 'ASTEROIDS_STOP') stop();
  });

  function start() {
    if (canvas) { resetGame(); return; }          // restart if already up
    buildOverlay();
    resetGame();
    loop();
    recordGamePlayed();
  }

  function stop() {
    cancelAnimationFrame(raf);
    window.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('keyup', onKeyUp, true);
    if (canvas) { canvas.remove(); canvas = null; ctx = null; }
    game = null;
    // keep __asteroidsOverlayLoaded=true so re-injection is cheap; overlay is gone.
  }

  /* ---------- overlay ---------- */
  function buildOverlay() {
    canvas = document.createElement('canvas');
    canvas.id = NS;
    canvas.style.cssText = [
      'position:fixed', 'inset:0', 'width:100vw', 'height:100vh',
      'z-index:2147483647', 'pointer-events:none',
      'background:rgba(5,5,10,0.55)'
    ].join(';');
    // pointer-events:none so the page stays clickable; game uses keys only.
    document.documentElement.appendChild(canvas);
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
  }

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  /* ---------- input ---------- */
  const keys = {};
  function onKeyDown(e) {
    if (e.key === 'Escape') { stop(); return; }
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', ' '].includes(e.key)) {
      e.preventDefault(); e.stopPropagation();
      keys[e.key] = true;
    }
  }
  function onKeyUp(e) { keys[e.key] = false; }

  /* ---------- game state ---------- */
  function resetGame() {
    const W = canvas.width, H = canvas.height;
    game = {
      ship: { x: W / 2, y: H / 2, a: -Math.PI / 2, vx: 0, vy: 0 },
      bullets: [], rocks: [], parts: [],
      score: 0, lives: 3, level: 1, over: false,
      cooldown: 0, msg: ''
    };
    spawnRocks(3 + game.level);
  }

  function spawnRocks(n) {
    const W = canvas.width, H = canvas.height;
    for (let i = 0; i < n; i++) spawnRock(W, H, 3);
  }

  function spawnRock(W, H, size) {
    const r = size * 22;
    let x, y;
    do { x = Math.random() * W; y = Math.random() * H; }
    while (game && dist(x, y, game.ship.x, game.ship.y) < r + 120);
    const a = Math.random() * Math.PI * 2;
    const sp = (4 - size) * 0.6 + Math.random() * 0.8;
    game.rocks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r, size,
      rot: Math.random() * Math.PI * 2, vr: (Math.random() - .5) * .04,
      verts: rockVerts() });
  }

  function rockVerts() {
    const n = 8 + Math.floor(Math.random() * 4), v = [];
    for (let i = 0; i < n; i++) v.push(0.75 + Math.random() * 0.45);
    return v;
  }

  function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }

  /* ---------- update ---------- */
  function update() {
    const W = canvas.width, H = canvas.height, s = game.ship;
    if (game.over) return;

    if (keys['ArrowLeft']) s.a -= 0.09;
    if (keys['ArrowRight']) s.a += 0.09;
    if (keys['ArrowUp']) { s.vx += Math.cos(s.a) * 0.22; s.vy += Math.sin(s.a) * 0.22; }
    s.vx *= 0.985; s.vy *= 0.985;
    s.x = (s.x + s.vx + W) % W; s.y = (s.y + s.vy + H) % H;

    if (game.cooldown > 0) game.cooldown--;
    if (keys[' '] && game.cooldown === 0) {
      game.bullets.push({ x: s.x + Math.cos(s.a) * 16, y: s.y + Math.sin(s.a) * 16,
        vx: Math.cos(s.a) * 9 + s.vx, vy: Math.sin(s.a) * 9 + s.vy, life: 55 });
      game.cooldown = 9;
    }

    // bullets
    for (let i = game.bullets.length - 1; i >= 0; i--) {
      const b = game.bullets[i];
      b.x = (b.x + b.vx + W) % W; b.y = (b.y + b.vy + H) % H;
      if (--b.life <= 0) game.bullets.splice(i, 1);
    }

    // rocks
    for (const r of game.rocks) {
      r.x = (r.x + r.vx + W) % W; r.y = (r.y + r.vy + H) % H; r.rot += r.vr;
    }

    // bullets vs rocks
    for (let i = game.bullets.length - 1; i >= 0; i--) {
      const b = game.bullets[i];
      for (let j = game.rocks.length - 1; j >= 0; j--) {
        const r = game.rocks[j];
        if (dist(b.x, b.y, r.x, r.y) < r.r) {
          game.bullets.splice(i, 1);
          shatter(r, j);
          break;
        }
      }
    }

    // ship vs rocks
    for (let j = game.rocks.length - 1; j >= 0; j--) {
      const r = game.rocks[j];
      if (dist(s.x, s.y, r.x, r.y) < r.r + 10) {
        explode(s.x, s.y);
        game.rocks.splice(j, 1);
        game.lives--;
        if (game.lives <= 0) { gameOver(); return; }
        s.x = W / 2; s.y = H / 2; s.vx = s.vy = 0; s.a = -Math.PI / 2;
        break;
      }
    }

    // particles
    for (let i = game.parts.length - 1; i >= 0; i--) {
      const p = game.parts[i];
      p.x += p.vx; p.y += p.vy; p.vx *= 0.96; p.vy *= 0.96;
      if (--p.life <= 0) game.parts.splice(i, 1);
    }

    // next level
    if (game.rocks.length === 0) {
      game.level++;
      game.msg = 'LEVEL ' + game.level;
      setTimeout(() => { if (game) game.msg = ''; }, 1500);
      spawnRocks(3 + game.level);
    }
  }

  function shatter(r, idx) {
    game.score += (4 - r.size) * 50;
    explode(r.x, r.y);
    game.rocks.splice(idx, 1);
    if (r.size > 1) {
      for (let k = 0; k < 2; k++) {
        const nr = r.size - 1;
        const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 1.5;
        game.rocks.push({ x: r.x, y: r.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          r: nr * 22, size: nr, rot: Math.random() * 6, vr: (Math.random() - .5) * .06,
          verts: rockVerts() });
      }
    }
  }

  function explode(x, y) {
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 4;
      game.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 20 + Math.random() * 20 });
    }
  }

  function gameOver() {
    game.over = true;
    chrome.storage.local.get({ stats: { best: 0, games: 0 } }, ({ stats }) => {
      stats.best = Math.max(stats.best, game ? game.score : 0);
      chrome.storage.local.set({ stats });
    });
  }

  async function recordGamePlayed() {
    const { stats } = await chrome.storage.local.get({ stats: { best: 0, games: 0 } });
    stats.games++;
    await chrome.storage.local.set({ stats });
  }

  /* ---------- render ---------- */
  function draw() {
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    if (!game) return;

    // rocks
    ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 2;
    for (const r of game.rocks) {
      ctx.save(); ctx.translate(r.x, r.y); ctx.rotate(r.rot);
      ctx.beginPath();
      const n = r.verts.length;
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2, rr = r.r * r.verts[i % n];
        i ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr)
          : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.stroke(); ctx.restore();
    }

    // bullets
    ctx.fillStyle = '#e8faff';
    for (const b of game.bullets) { ctx.beginPath(); ctx.arc(b.x, b.y, 2.5, 0, 7); ctx.fill(); }

    // particles
    ctx.fillStyle = '#a5f3fc';
    for (const p of game.parts) { ctx.globalAlpha = p.life / 40; ctx.fillRect(p.x, p.y, 3, 3); }
    ctx.globalAlpha = 1;

    // ship
    if (!game.over) {
      const s = game.ship;
      ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.a);
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(16, 0); ctx.lineTo(-12, 11); ctx.lineTo(-7, 0); ctx.lineTo(-12, -11); ctx.closePath();
      ctx.stroke();
      if (keys['ArrowUp']) { // flame
        ctx.strokeStyle = '#f59e0b';
        ctx.beginPath(); ctx.moveTo(-12, 6); ctx.lineTo(-22, 0); ctx.lineTo(-12, -6); ctx.stroke();
      }
      ctx.restore();
    }

    // HUD
    ctx.fillStyle = '#e8e8f0'; ctx.font = '16px monospace'; ctx.textAlign = 'left';
    ctx.fillText('SCORE ' + game.score, 16, 28);
    ctx.fillText('LIVES ' + '●'.repeat(Math.max(0, game.lives)), 16, 52);
    ctx.fillText('LEVEL ' + game.level, 16, 76);
    ctx.fillStyle = '#9a9ab0'; ctx.font = '12px monospace'; ctx.textAlign = 'right';
    ctx.fillText('RETRO ASTEROIDS · overlay only · Esc quits', W - 16, 24);

    if (game.msg) {
      ctx.fillStyle = '#22d3ee'; ctx.font = 'bold 42px monospace'; ctx.textAlign = 'center';
      ctx.fillText(game.msg, W / 2, H / 2);
    }
    if (game.over) {
      ctx.fillStyle = 'rgba(5,5,10,0.6)'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#22d3ee'; ctx.font = 'bold 48px monospace'; ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', W / 2, H / 2 - 20);
      ctx.fillStyle = '#e8e8f0'; ctx.font = '20px monospace';
      ctx.fillText('SCORE ' + game.score, W / 2, H / 2 + 24);
      ctx.fillStyle = '#9a9ab0'; ctx.font = '14px monospace';
      ctx.fillText('press Esc to leave · reopen popup to play again', W / 2, H / 2 + 56);
    }
  }

  function loop() {
    update();
    draw();
    raf = requestAnimationFrame(loop);
  }
})();
