/* Brick Breaker game — injected on explicit user click only.
   The page DOM is never modified: bricks are drawn on a canvas overlay
   (clones of page-block positions), and everything is removed on exit. */
(() => {
  if (window.__bbActive) return; // guard against double injection
  window.__bbActive = true;

  const ACCENT = '#fb923c';
  let state = null;

  // --- helpers ---------------------------------------------------------------
  // Collect visible page blocks to use as bricks (position clones only).
  function collectBlocks() {
    const els = document.querySelectorAll(
      'div,section,article,main,aside,header,footer,img,video,p,figure,li,table,form,nav'
    );
    const out = [];
    for (const el of els) {
      if (out.length >= 64) break;
      if (el.closest('#bb-overlay,#bb-exit-btn')) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 26 || r.height < 18) continue;
      if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') continue;
      out.push({ x: Math.max(0, r.left), y: Math.max(0, r.top), w: Math.min(r.width, innerWidth), h: Math.min(r.height, innerHeight) });
    }
    // De-duplicate heavily overlapping boxes.
    return out.filter((b, i) => !out.slice(0, i).some(o =>
      Math.abs(o.x - b.x) < 12 && Math.abs(o.y - b.y) < 12 &&
      Math.abs(o.w - b.w) < 24 && Math.abs(o.h - b.h) < 24
    ));
  }

  const PALETTE = ['#fb923c', '#f59e0b', '#ef4444', '#f97316', '#eab308', '#fb7185'];

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // --- game lifecycle --------------------------------------------------------
  function start(ballSpeed) {
    stop(); // clean slate if re-triggered
    const blocks = collectBlocks();

    const canvas = document.createElement('canvas');
    canvas.id = 'bb-overlay';
    canvas.width = innerWidth; canvas.height = innerHeight;
    Object.assign(canvas.style, {
      position: 'fixed', inset: '0', zIndex: '2147483646',
      pointerEvents: 'none', cursor: 'none'
    });
    document.documentElement.appendChild(canvas);

    const exitBtn = document.createElement('button');
    exitBtn.id = 'bb-exit-btn';
    exitBtn.textContent = '✕ Exit game';
    Object.assign(exitBtn.style, {
      position: 'fixed', top: '10px', right: '12px', zIndex: '2147483647',
      background: 'rgba(20,20,26,.85)', color: '#fff',
      border: '1px solid rgba(255,255,255,.25)', borderRadius: '10px',
      padding: '8px 12px', fontSize: '13px', cursor: 'pointer'
    });
    document.documentElement.appendChild(exitBtn);

    const ctx = canvas.getContext('2d');
    const bricks = blocks.map((b, i) => ({ ...b, color: PALETTE[i % PALETTE.length], alive: true }));
    const paddle = { w: 110, h: 14, x: innerWidth / 2 - 55, y: innerHeight - 48 };
    const ball = { x: innerWidth / 2, y: innerHeight - 80, r: 8, dx: ballSpeed * 0.7, dy: -ballSpeed };

    state = {
      canvas, exitBtn, ctx, bricks, paddle, ball,
      score: 0, lives: 3, running: true, mouseX: innerWidth / 2,
      onMouse: (e) => { state.mouseX = e.clientX; },
      onKey: (e) => { if (e.key === 'Escape') finish(); },
      onResize: () => { canvas.width = innerWidth; canvas.height = innerHeight; },
    };
    addEventListener('mousemove', state.onMouse);
    addEventListener('keydown', state.onKey);
    addEventListener('resize', state.onResize);
    exitBtn.addEventListener('click', finish);

    requestAnimationFrame(tick);
  }

  function collide(ball, box) {
    return ball.x + ball.r > box.x && ball.x - ball.r < box.x + box.w &&
           ball.y + ball.r > box.y && ball.y - ball.r < box.y + box.h;
  }

  function tick() {
    if (!state || !state.running) return;
    const { ctx, ball, paddle, bricks } = state;
    const W = ctx.canvas.width, H = ctx.canvas.height;

    // paddle follows mouse
    paddle.x = Math.min(Math.max(state.mouseX - paddle.w / 2, 0), W - paddle.w);

    // ball motion
    ball.x += ball.dx; ball.y += ball.dy;
    if (ball.x - ball.r < 0 || ball.x + ball.r > W) ball.dx *= -1;
    if (ball.y - ball.r < 0) ball.dy *= -1;

    // paddle bounce (angle depends on hit position)
    if (ball.dy > 0 && collide(ball, paddle)) {
      const rel = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2);
      const sp = Math.hypot(ball.dx, ball.dy);
      ball.dx = rel * sp * 0.9;
      ball.dy = -Math.abs(Math.sqrt(Math.max(sp * sp - ball.dx * ball.dx, 1)));
      ball.y = paddle.y - ball.r - 1;
    }

    // brick hits
    for (const b of bricks) {
      if (!b.alive) continue;
      if (collide(ball, b)) {
        b.alive = false;
        state.score += 10;
        // bounce on the axis of least penetration
        const overlapX = Math.min(ball.x + ball.r - b.x, b.x + b.w - (ball.x - ball.r));
        const overlapY = Math.min(ball.y + ball.r - b.y, b.y + b.h - (ball.y - ball.r));
        if (overlapX < overlapY) ball.dx *= -1; else ball.dy *= -1;
        break;
      }
    }

    // missed paddle
    if (ball.y - ball.r > H) {
      state.lives -= 1;
      if (state.lives <= 0) return finish();
      ball.x = W / 2; ball.y = H - 80;
      ball.dx = Math.abs(ball.dx) * 0.7; ball.dy = -Math.abs(ball.dy);
    }

    // win
    if (bricks.every(b => !b.alive)) { state.score += 100; return finish(); }

    // draw
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(10,10,14,.55)';
    ctx.fillRect(0, 0, W, H);
    for (const b of bricks) {
      if (!b.alive) continue;
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = b.color;
      roundRect(ctx, b.x, b.y, b.w, b.h, 6);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(255,255,255,.35)';
      ctx.stroke();
    }
    ctx.fillStyle = ACCENT;
    roundRect(ctx, paddle.x, paddle.y, paddle.w, paddle.h, 7);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();

    // HUD
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 15px system-ui,sans-serif';
    ctx.fillText(`Score ${state.score}`, 16, 28);
    ctx.fillText(`Lives ${'●'.repeat(state.lives)}`, 16, 50);

    requestAnimationFrame(tick);
  }

  function stop() {
    if (!state) return;
    state.running = false;
    removeEventListener('mousemove', state.onMouse);
    removeEventListener('keydown', state.onKey);
    removeEventListener('resize', state.onResize);
    state.canvas.remove();
    state.exitBtn.remove();
    state = null;
  }

  // Finish: save score, remove overlay, restore the page exactly.
  function finish() {
    const score = state ? state.score : 0;
    stop();
    window.__bbActive = false;
    chrome.storage.local.get({ highScore: 0 }, (d) => {
      chrome.storage.local.set({
        lastScore: score,
        highScore: Math.max(d.highScore, score),
      });
    });
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === 'BRICK_START') start(msg.ballSpeed || 4.6);
  });
})();
