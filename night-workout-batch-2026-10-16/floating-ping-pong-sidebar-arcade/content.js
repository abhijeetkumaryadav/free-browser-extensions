/* Floating Ping Pong Arcade — content script.
   A user-triggered floating game panel. Clicking the popup button toggles it.
   The panel is the ONLY thing added to the page; closing removes every trace.
   The page DOM is otherwise never modified.
   NOTE: this file runs in the page's isolated world; it must be self-contained. */

(() => {
  // Toggle: if the panel already exists, remove it and stop.
  const existing = document.getElementById('__pp_arcade_panel');
  if (existing) {
    existing.remove();
    window.dispatchEvent(new Event('__pp_arcade_stop'));
    return;
  }

  const ACCENT = '#34d399';
  const DIFF = {
    easy:   { ai: 3.2, ball: 4.0 },
    medium: { ai: 4.6, ball: 5.2 },
    hard:   { ai: 6.4, ball: 6.8 },
  };

  let settings = { difficulty: 'medium', pointsToWin: 5, best: 0, wins: 0 };
  const storageGet = (cb) => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get(settings, (s) => { settings = { ...settings, ...s }; cb(); });
    } else { cb(); }
  };
  const storageSet = (patch) => {
    if (typeof chrome !== 'undefined' && chrome.storage) chrome.storage.local.set(patch);
  };

  // ---- Build the floating panel (draggable by its header) ----
  const panel = document.createElement('div');
  panel.id = '__pp_arcade_panel';
  panel.style.cssText = [
    'position:fixed', 'top:80px', 'right:16px', 'z-index:2147483647',
    'width:392px', 'border-radius:16px', 'overflow:hidden',
    'background:rgba(20,20,26,0.86)', 'backdrop-filter:blur(12px)',
    'border:1px solid rgba(255,255,255,0.12)',
    'box-shadow:0 12px 40px rgba(0,0,0,0.55)',
    'font-family:"Segoe UI",system-ui,sans-serif', 'color:#f3f4f6',
  ].join(';');

  panel.innerHTML = `
    <div id="__pp_head" style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;cursor:move;border-bottom:1px solid rgba(255,255,255,0.08);">
      <div style="display:flex;align-items:center;gap:8px;font-weight:650;font-size:14px;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${ACCENT}" stroke-width="2" stroke-linecap="round">
          <circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>
        </svg>
        Ping Pong Arcade
      </div>
      <button id="__pp_close" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);color:#f3f4f6;border-radius:8px;width:28px;height:28px;cursor:pointer;font-size:15px;line-height:1;">&#10005;</button>
    </div>
    <div id="__pp_score" style="text-align:center;font-size:26px;font-weight:700;padding:8px 0 0;letter-spacing:2px;">
      <span style="color:${ACCENT}">0</span><span style="color:#6b7280;margin:0 10px;">:</span><span style="color:#9ca3af">0</span>
    </div>
    <div id="__pp_msg" style="text-align:center;font-size:12px;color:#9ca3af;height:18px;">Move: mouse or &#8592;&#8594; &middot; Space: pause</div>
    <canvas id="__pp_canvas" width="360" height="440" style="display:block;margin:0 auto 12px;border-radius:10px;"></canvas>
  `;
  document.body.appendChild(panel);

  const canvas = panel.querySelector('#__pp_canvas');
  const ctx = canvas.getContext('2d');
  const scoreEl = panel.querySelector('#__pp_score');
  const msgEl = panel.querySelector('#__pp_msg');
  panel.querySelector('#__pp_close').addEventListener('click', () => {
    cleanup();
    panel.remove();
  });

  // Draggable header.
  (() => {
    const head = panel.querySelector('#__pp_head');
    let sx, sy, ox, oy, dragging = false;
    head.addEventListener('mousedown', (e) => {
      dragging = true; sx = e.clientX; sy = e.clientY;
      const r = panel.getBoundingClientRect(); ox = r.left; oy = r.top;
      panel.style.right = 'auto'; panel.style.left = ox + 'px'; panel.style.top = oy + 'px';
    });
    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      panel.style.left = Math.max(0, ox + e.clientX - sx) + 'px';
      panel.style.top = Math.max(0, oy + e.clientY - sy) + 'px';
    });
    window.addEventListener('mouseup', () => { dragging = false; });
  })();

  // ---- Game state ----
  const W = 360, H = 440, PADDLE_W = 70, PADDLE_H = 10;
  const game = {
    px: W / 2 - PADDLE_W / 2,      // player paddle (bottom)
    ax: W / 2 - PADDLE_W / 2,      // AI paddle (top)
    ball: { x: W / 2, y: H / 2, vx: 0, vy: 0 },
    player: 0, ai: 0,
    serveDir: 1, paused: false, over: false, keys: {}, speedMul: 1,
  };

  function serve() {
    game.ball.x = W / 2;
    game.ball.y = H / 2;
    const d = DIFF[settings.difficulty];
    const ang = (Math.random() * 0.7 + 0.35) * (Math.random() < 0.5 ? -1 : 1);
    game.ball.vx = Math.sin(ang) * d.ball;
    game.ball.vy = Math.cos(ang) * d.ball * game.serveDir;
    game.speedMul = 1;
  }

  function updateScoreboard() {
    scoreEl.innerHTML =
      `<span style="color:${ACCENT}">${game.player}</span>` +
      `<span style="color:#6b7280;margin:0 10px;">:</span>` +
      `<span style="color:#9ca3af">${game.ai}</span>`;
  }

  function endMatch(playerWon) {
    game.over = true;
    if (playerWon) {
      settings.wins = (settings.wins || 0) + 1;
      msgEl.textContent = 'You win! Click the panel to play again.';
    } else {
      msgEl.textContent = 'AI wins. Click the panel to play again.';
    }
    settings.best = Math.max(settings.best || 0, game.player);
    storageSet({ best: settings.best, wins: settings.wins });
  }

  function step() {
    if (game.paused || game.over) return;
    const d = DIFF[settings.difficulty];

    // Player paddle: mouse or arrow keys.
    if (game.keys['ArrowLeft']) game.px -= 7;
    if (game.keys['ArrowRight']) game.px += 7;
    game.px = Math.max(0, Math.min(W - PADDLE_W, game.px));

    // AI paddle tracks the ball with limited speed.
    const target = game.ball.x - PADDLE_W / 2;
    const diff = target - game.ax;
    game.ax += Math.max(-d.ai, Math.min(d.ai, diff));
    game.ax = Math.max(0, Math.min(W - PADDLE_W, game.ax));

    // Ball.
    const b = game.ball;
    b.x += b.vx * game.speedMul;
    b.y += b.vy * game.speedMul;

    // Side walls.
    if (b.x < 6) { b.x = 6; b.vx = Math.abs(b.vx); }
    if (b.x > W - 6) { b.x = W - 6; b.vx = -Math.abs(b.vx); }

    const paddleTop = H - 30; // player paddle zone
    // Player paddle collision (moving down onto it).
    if (b.vy > 0 && b.y >= paddleTop - 6 && b.y <= paddleTop + PADDLE_H &&
        b.x >= game.px - 4 && b.x <= game.px + PADDLE_W + 4) {
      const rel = (b.x - (game.px + PADDLE_W / 2)) / (PADDLE_W / 2);
      const sp = Math.hypot(b.vx, b.vy);
      b.vx = rel * sp * 0.9;
      b.vy = -Math.sqrt(Math.max(1, sp * sp - b.vx * b.vx));
      b.y = paddleTop - 7;
      game.speedMul = Math.min(1.6, game.speedMul + 0.03);
    }
    // AI paddle collision (top).
    const aiZone = 24;
    if (b.vy < 0 && b.y <= aiZone + PADDLE_H + 6 && b.y >= aiZone &&
        b.x >= game.ax - 4 && b.x <= game.ax + PADDLE_W + 4) {
      const rel = (b.x - (game.ax + PADDLE_W / 2)) / (PADDLE_W / 2);
      const sp = Math.hypot(b.vx, b.vy);
      b.vx = rel * sp * 0.9;
      b.vy = Math.sqrt(Math.max(1, sp * sp - b.vx * b.vx));
      b.y = aiZone + PADDLE_H + 7;
      game.speedMul = Math.min(1.6, game.speedMul + 0.03);
    }

    // Scoring.
    if (b.y < -10) { game.player++; game.serveDir = 1; onPoint(); }
    if (b.y > H + 10) { game.ai++; game.serveDir = -1; onPoint(); }
  }

  function onPoint() {
    updateScoreboard();
    if (game.player >= settings.pointsToWin) { endMatch(true); return; }
    if (game.ai >= settings.pointsToWin) { endMatch(false); return; }
    serve();
  }

  function draw() {
    ctx.fillStyle = '#101016';
    ctx.fillRect(0, 0, W, H);
    // Center line.
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.setLineDash([6, 6]);
    ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke();
    ctx.setLineDash([]);
    // AI paddle (top).
    ctx.fillStyle = '#9ca3af';
    roundRect(game.ax, 24, PADDLE_W, PADDLE_H, 5); ctx.fill();
    // Player paddle (bottom).
    ctx.fillStyle = ACCENT;
    roundRect(game.px, H - 30, PADDLE_W, PADDLE_H, 5); ctx.fill();
    // Ball.
    ctx.fillStyle = '#f3f4f6';
    ctx.beginPath(); ctx.arc(game.ball.x, game.ball.y, 6, 0, Math.PI * 2); ctx.fill();

    if (game.over) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#f3f4f6';
      ctx.font = '700 22px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(game.player > game.ai ? 'YOU WIN!' : 'AI WINS', W / 2, H / 2 - 8);
      ctx.font = '14px sans-serif';
      ctx.fillStyle = '#9ca3af';
      ctx.fillText('Click the panel to play again', W / 2, H / 2 + 20);
    } else if (game.paused) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#f3f4f6';
      ctx.font = '700 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PAUSED', W / 2, H / 2);
    }
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ---- Input ----
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) * (W / r.width);
    game.px = Math.max(0, Math.min(W - PADDLE_W, x - PADDLE_W / 2));
  });
  const onKeyDown = (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      game.keys[e.key] = true;
      e.preventDefault();
    } else if (e.code === 'Space') {
      if (!game.over) { game.paused = !game.paused; }
      e.preventDefault();
    }
  };
  const onKeyUp = (e) => { game.keys[e.key] = false; };
  window.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('keyup', onKeyUp, true);
  canvas.addEventListener('click', () => {
    if (game.over) {
      game.player = 0; game.ai = 0; game.over = false;
      game.px = W / 2 - PADDLE_W / 2; game.ax = W / 2 - PADDLE_W / 2;
      updateScoreboard();
      msgEl.textContent = 'Move: mouse or \u2190\u2192 · Space: pause';
      serve();
    }
  });

  // ---- Main loop + cleanup ----
  let raf = 0, alive = true;
  function loop() {
    if (!alive) return;
    step();
    draw();
    raf = requestAnimationFrame(loop);
  }
  function cleanup() {
    alive = false;
    cancelAnimationFrame(raf);
    window.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('keyup', onKeyUp, true);
    window.removeEventListener('__pp_arcade_stop', onStop);
  }
  function onStop() { cleanup(); const p = document.getElementById('__pp_arcade_panel'); if (p) p.remove(); }
  window.addEventListener('__pp_arcade_stop', onStop);

  // Start with saved settings.
  storageGet(() => {
    updateScoreboard();
    serve();
    loop();
  });
})();
