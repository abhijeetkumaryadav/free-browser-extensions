/* Vocabulary Invaders — Text Blaster
 * User-triggered typing game. Everything renders on a removable overlay;
 * the underlying page DOM is NEVER touched. Esc or the Quit button removes
 * every trace. 100% local, zero network.
 */
(function () {
  'use strict';

  // If a game is already running, stop it first (toggle behavior).
  if (window.__vocabInvaders) { window.__vocabInvaders.stop(); }

  /* ---------------- word list (bundled, local) ---------------- */
  const WORDS = [
    'orbit','pixel','comet','solar','lunar','nova','aster','cosmos','nebula','galaxy',
    'rocket','planet','crater','eclipse','zenith','gravity','meteor','plasma','aurora','titan',
    'velvet','saffron','ember','marble','copper','amber','onyx','quartz','obsidian','sapphire',
    'breeze','cascade','thunder','mistral','monsoon','zephyr','tundra','savanna','meadow','glacier',
    'compass','voyage','harbor','summit','canyon','delta','fjord','oasis','ridge','tundra'
  ];

  /* ---------------- configuration ---------------- */
  const DIFF = (window.__vocabOptions && window.__vocabOptions.difficulty) || 'normal';
  const CFG = {
    easy:   { minLen: 3, maxLen: 5,  speed: 0.35, spawnMs: 2200, lives: 5 },
    normal: { minLen: 4, maxLen: 7,  speed: 0.6,  spawnMs: 1600, lives: 3 },
    hard:   { minLen: 5, maxLen: 9,  speed: 1.0,  spawnMs: 1100, lives: 3 }
  }[DIFF] || { minLen: 4, maxLen: 7, speed: 0.6, spawnMs: 1600, lives: 3 };

  const pool = WORDS.filter(w => w.length >= CFG.minLen && w.length <= CFG.maxLen);

  /* ---------------- overlay setup ---------------- */
  const overlay = document.createElement('div');
  overlay.id = 'vocab-invaders-overlay';
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:2147483647;background:rgba(5,5,10,.93);' +
    'font-family:system-ui,sans-serif;overflow:hidden;';

  const canvas = document.createElement('canvas');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  overlay.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  // HUD: score, lives, wave, quit — absolutely positioned above the canvas.
  const hud = document.createElement('div');
  hud.style.cssText =
    'position:absolute;top:12px;left:14px;right:14px;display:flex;gap:14px;' +
    'align-items:center;color:#e8e8f0;font-size:15px;font-weight:600;';
  hud.innerHTML =
    '<span id="vi-score" style="color:#34d399">Score 0</span>' +
    '<span id="vi-lives" style="color:#f87171">Lives ' + CFG.lives + '</span>' +
    '<span id="vi-wave" style="color:#a8a8bd">Wave 1</span>' +
    '<span style="flex:1"></span>' +
    '<button id="vi-quit" style="background:#26262f;color:#e8e8f0;border:1px solid #3a3a46;' +
    'border-radius:8px;padding:6px 12px;cursor:pointer;font-weight:600">Quit (Esc)</button>';
  overlay.appendChild(hud);
  document.documentElement.appendChild(overlay);

  /* ---------------- game state ---------------- */
  const state = {
    invaders: [], particles: [], buffer: '',
    score: 0, lives: CFG.lives, wave: 1, destroyed: 0,
    running: true, lastSpawn: 0, streak: 0, over: false
  };

  const rnd = (a, b) => a + Math.random() * (b - a);
  const pickWord = () => pool[Math.floor(Math.random() * pool.length)];

  function spawn() {
    const word = pickWord();
    state.invaders.push({
      word, x: rnd(40, canvas.width - 140), y: -40,
      speed: CFG.speed * rnd(0.85, 1.2) * (1 + (state.wave - 1) * 0.12)
    });
  }

  function blast(inv, idx) {
    state.score += inv.word.length * 10 + state.streak * 5;
    state.streak++;
    state.destroyed++;
    for (let i = 0; i < 14; i++) {
      state.particles.push({
        x: inv.x + 50, y: inv.y + 16,
        vx: rnd(-3, 3), vy: rnd(-3, 1), life: 30
      });
    }
    state.invaders.splice(idx, 1);
    state.buffer = '';
    if (state.destroyed % 12 === 0) state.wave++;
    updateHud();
  }

  function updateHud() {
    overlay.querySelector('#vi-score').textContent = 'Score ' + state.score;
    overlay.querySelector('#vi-lives').textContent = 'Lives ' + state.lives;
    overlay.querySelector('#vi-wave').textContent = 'Wave ' + state.wave;
  }

  /* ---------------- typing input ---------------- */
  function onKey(e) {
    if (!state.running) return;
    if (e.key === 'Escape') { api.stop(); return; }
    if (e.key.length !== 1 || !/[a-z]/i.test(e.key)) {
      if (e.key === 'Backspace') state.buffer = state.buffer.slice(0, -1);
      return;
    }
    const next = (state.buffer + e.key).toLowerCase();
    // Find an invader whose word still matches the typed prefix.
    const idx = state.invaders.findIndex(inv => inv.word.startsWith(next));
    if (idx === -1) { state.streak = 0; state.buffer = ''; return; }
    state.buffer = next;
    const target = state.invaders[idx];
    if (target.word === next) blast(target, idx);
  }

  /* ---------------- rendering ---------------- */
  function drawInvader(inv) {
    const w = 108, h = 34;
    ctx.fillStyle = 'rgba(52,211,153,.12)';
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(inv.x, inv.y, w, h, 8); else ctx.rect(inv.x, inv.y, w, h);
    ctx.fill(); ctx.stroke();
    // Word text; typed prefix highlighted in accent color.
    ctx.font = 'bold 17px system-ui,sans-serif';
    const typed = state.buffer && inv.word.startsWith(state.buffer) ? state.buffer : '';
    ctx.fillStyle = '#34d399';
    ctx.fillText(typed, inv.x + 10, inv.y + 23);
    ctx.fillStyle = '#e8e8f0';
    ctx.fillText(inv.word.slice(typed.length), inv.x + 10 + ctx.measureText(typed).width, inv.y + 23);
  }

  function frame(ts) {
    if (!state.running) return;
    if (state.lives <= 0) { gameOver(); return; }
    if (ts - state.lastSpawn > CFG.spawnMs) { spawn(); state.lastSpawn = ts; }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Move + draw invaders.
    for (let i = state.invaders.length - 1; i >= 0; i--) {
      const inv = state.invaders[i];
      inv.y += inv.speed;
      if (inv.y > canvas.height - 50) {
        state.invaders.splice(i, 1);
        state.lives--; state.streak = 0; state.buffer = '';
        updateHud();
        continue;
      }
      drawInvader(inv);
    }

    // Particles.
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.x += p.vx; p.y += p.vy; p.life--;
      ctx.fillStyle = 'rgba(52,211,153,' + Math.max(0, p.life / 30) + ')';
      ctx.fillRect(p.x, p.y, 3, 3);
      if (p.life <= 0) state.particles.splice(i, 1);
    }

    // Current buffer at the bottom.
    ctx.fillStyle = '#a8a8bd';
    ctx.font = '16px system-ui,sans-serif';
    ctx.fillText('Type: ' + state.buffer + '▌', 20, canvas.height - 20);

    requestAnimationFrame(frame);
  }

  function gameOver() {
    state.running = false; state.over = true;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#e8e8f0';
    ctx.font = 'bold 34px system-ui,sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Game Over', canvas.width / 2, canvas.height / 2 - 20);
    ctx.font = '20px system-ui,sans-serif';
    ctx.fillStyle = '#34d399';
    ctx.fillText('Final score: ' + state.score, canvas.width / 2, canvas.height / 2 + 20);
    ctx.fillStyle = '#a8a8bd';
    ctx.fillText('Press Esc to close', canvas.width / 2, canvas.height / 2 + 50);
    // Persist best score.
    chrome.storage.local.get({ viBest: 0 }, (r) => {
      if (state.score > r.viBest) chrome.storage.local.set({ viBest: state.score });
    });
  }

  /* ---------------- public API + teardown ---------------- */
  function stop() {
    state.running = false;
    document.removeEventListener('keydown', onKey, true);
    hud.querySelector('#vi-quit').removeEventListener('click', stop);
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    if (window.__vocabInvaders === api) delete window.__vocabInvaders;
  }
  const api = { stop };
  window.__vocabInvaders = api;

  document.addEventListener('keydown', onKey, true);
  hud.querySelector('#vi-quit').addEventListener('click', stop);
  updateHud();
  requestAnimationFrame(frame);
})();
