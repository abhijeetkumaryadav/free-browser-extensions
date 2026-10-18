/* Retro Snake Word Spelling Eater — content script.
 * Canvas-overlay arcade game: steer the snake, eat letter pellets in word
 * order to spell words; wrong letters cost a life. The page DOM is never
 * modified; teardown removes every trace. 100% local, bundled word list.
 */
(() => {
  'use strict';
  if (window.__snakeBooted) return; // already injected on this tab
  window.__snakeBooted = true;

  // Bundled word list — the game never touches the network.
  const WORDS = [
    'CAT', 'DOG', 'SUN', 'CODE', 'MOUSE', 'SNAKE', 'ARCADE', 'RETRO', 'LASER',
    'COMET', 'ROBOT', 'TIGER', 'OCEAN', 'MUSIC', 'CLOUD', 'STORM', 'FLAME',
    'GHOST', 'NINJA', 'PIZZA', 'DRAGON', 'WIZARD', 'PLANET', 'ROCKET',
    'SCORE', 'LEVEL', 'BONUS', 'SPEED', 'GLOW', 'NEON', 'TURBO', 'QUEST',
    'ZEBRA', 'JUNGLE', 'CRYSTAL', 'THUNDER', 'SHADOW', 'LIGHT', 'DREAM',
    'POWER', 'PIXEL', 'BROWSER',
  ];
  const CELL = 24;
  const HUD_H = 46;

  // --- Overlay surface -------------------------------------------------------
  const canvas = document.createElement('canvas');
  Object.assign(canvas.style, {
    position: 'fixed', inset: '0', width: '100vw', height: '100vh',
    zIndex: '2147483647', display: 'block', cursor: 'none',
  });
  document.documentElement.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  // --- State -----------------------------------------------------------------
  let W = 0, H = 0, cols = 0, rows = 0;
  const S = {
    snake: [], dir: { x: 1, y: 0 }, pending: { x: 1, y: 0 },
    pellets: [], word: '', progress: 0,
    score: 0, lives: 3, level: 1, best: 0,
    tickMs: 110, loop: 0, running: false, over: false, flash: 0,
  };

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
    cols = Math.floor(W / CELL);
    rows = Math.floor((H - HUD_H) / CELL);
  }

  /** Random grid cell not occupied by the snake or a pellet. */
  function rndFree() {
    const occ = new Set(S.snake.map((s) => s.x + ',' + s.y));
    S.pellets.forEach((p) => occ.add(p.x + ',' + p.y));
    for (let t = 0; t < 300; t++) {
      const x = (Math.random() * cols) | 0;
      const y = (Math.random() * rows) | 0;
      if (!occ.has(x + ',' + y)) return { x, y };
    }
    return null;
  }

  function pickWord() {
    let w;
    do { w = WORDS[(Math.random() * WORDS.length) | 0]; } while (w === S.word);
    return w;
  }

  const neededChar = () => S.word[S.progress];

  /** Keep one needed-letter pellet on board plus decoy letters. */
  function ensurePellets() {
    const need = neededChar();
    if (need && !S.pellets.some((p) => p.good)) {
      const c = rndFree();
      if (c) S.pellets.push({ x: c.x, y: c.y, ch: need, good: true });
    }
    while (S.pellets.length < 4) {
      const c = rndFree();
      if (!c) break;
      let ch;
      do { ch = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[(Math.random() * 26) | 0]; } while (ch === need);
      S.pellets.push({ x: c.x, y: c.y, ch, good: false });
    }
  }

  function resetSnake() {
    const cx = (cols / 2) | 0, cy = (rows / 2) | 0;
    S.snake = [
      { x: cx, y: cy }, { x: cx - 1, y: cy },
      { x: cx - 2, y: cy }, { x: cx - 3, y: cy },
    ];
    S.dir = { x: 1, y: 0 };
    S.pending = { x: 1, y: 0 };
  }

  function newWord() {
    S.word = pickWord();
    S.progress = 0;
    S.pellets = [];
    ensurePellets();
  }

  function start(tickMs) {
    S.tickMs = tickMs || 110;
    S.score = 0; S.lives = 3; S.level = 1;
    S.over = false; S.running = true; S.flash = 0;
    resetSnake();
    newWord();
    clearInterval(S.loop);
    S.loop = setInterval(tick, S.tickMs);
  }

  function loseLife() {
    S.lives--;
    S.flash = 6;
    if (S.lives <= 0) gameOver();
    else resetSnake();
  }

  function gameOver() {
    S.over = true;
    S.running = false;
    clearInterval(S.loop);
    if (S.score > S.best) {
      S.best = S.score;
      chrome.storage.local.set({ snake_best: S.best });
    }
  }

  // --- Game logic ------------------------------------------------------------
  function tick() {
    if (!S.running || S.over) return;
    S.dir = S.pending;
    const head = { x: S.snake[0].x + S.dir.x, y: S.snake[0].y + S.dir.y };

    if (head.x < 0 || head.y < 0 || head.x >= cols || head.y >= rows) { loseLife(); return; }
    for (let i = 0; i < S.snake.length - 1; i++) { // ignore the tail tip (it moves away)
      if (S.snake[i].x === head.x && S.snake[i].y === head.y) { loseLife(); return; }
    }

    S.snake.unshift(head);
    const pi = S.pellets.findIndex((p) => p.x === head.x && p.y === head.y);
    if (pi >= 0) {
      const p = S.pellets[pi];
      S.pellets.splice(pi, 1);
      if (p.good) {
        // Correct next letter: score, grow, maybe complete the word.
        S.progress++;
        S.score += 10 * S.level;
        if (S.progress >= S.word.length) {
          S.score += S.word.length * 25; // word bonus
          S.level++;
          S.tickMs = Math.max(55, S.tickMs - 10); // speed up
          clearInterval(S.loop);
          S.loop = setInterval(tick, S.tickMs);
          newWord();
        }
        // no tail pop -> snake grows
      } else {
        // Wrong letter: lose a life, no growth.
        S.snake.pop();
        loseLife();
        if (S.over) return;
      }
    } else {
      S.snake.pop();
    }
    ensurePellets();
  }

  // --- Rendering -------------------------------------------------------------
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawHUD() {
    ctx.fillStyle = 'rgba(0,0,0,.5)';
    ctx.fillRect(0, 0, W, HUD_H);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.font = 'bold 15px system-ui, sans-serif';
    let x = 16;
    for (let i = 0; i < S.word.length; i++) {
      ctx.fillStyle = i < S.progress ? '#4ade80' : 'rgba(255,255,255,.35)';
      ctx.fillText(S.word[i], x, HUD_H / 2);
      x += 18;
    }
    ctx.textAlign = 'right';
    ctx.fillStyle = '#e9e9f1';
    const hearts = S.lives > 0 ? '♥'.repeat(S.lives) : '—';
    ctx.fillText('Score ' + S.score + '   ' + hearts + '   Lv ' + S.level + '   Best ' + S.best, W - 16, HUD_H / 2);
  }

  function drawGameOver() {
    ctx.fillStyle = 'rgba(0,0,0,.65)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f472b6';
    ctx.font = 'bold 42px system-ui, sans-serif';
    ctx.fillText('GAME OVER', W / 2, H / 2 - 40);
    ctx.fillStyle = '#e9e9f1';
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillText('Score ' + S.score + ' · Best ' + S.best, W / 2, H / 2 + 4);
    ctx.fillStyle = '#9aa0b5';
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText('Press R to play again · Esc to exit', W / 2, H / 2 + 38);
  }

  function render() {
    if (!window.__snakeBooted) return; // stopped mid-frame
    ctx.fillStyle = '#0b0d12';
    ctx.fillRect(0, 0, W, H);

    // Subtle grid.
    ctx.strokeStyle = 'rgba(255,255,255,.03)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= cols; x++) { ctx.moveTo(x * CELL + .5, HUD_H); ctx.lineTo(x * CELL + .5, H); }
    for (let y = 0; y <= rows; y++) { ctx.moveTo(0, HUD_H + y * CELL + .5); ctx.lineTo(W, HUD_H + y * CELL + .5); }
    ctx.stroke();

    // Pellets: green = needed letter, pink = decoy.
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 13px system-ui, sans-serif';
    for (const p of S.pellets) {
      const y0 = HUD_H + p.y * CELL;
      ctx.fillStyle = p.good ? 'rgba(74,222,128,.22)' : 'rgba(244,114,182,.16)';
      roundRect(p.x * CELL + 2, y0 + 2, CELL - 4, CELL - 4, 6);
      ctx.fill();
      ctx.fillStyle = p.good ? '#4ade80' : '#f472b6';
      ctx.fillText(p.ch, p.x * CELL + CELL / 2, y0 + CELL / 2 + 1);
    }

    // Snake: bright head, fading tail.
    S.snake.forEach((s, i) => {
      const y0 = HUD_H + s.y * CELL;
      const fade = 0.9 - (i / S.snake.length) * 0.6;
      ctx.fillStyle = i === 0 ? '#4ade80' : 'rgba(74,222,128,' + fade.toFixed(2) + ')';
      roundRect(s.x * CELL + 1, y0 + 1, CELL - 2, CELL - 2, 5);
      ctx.fill();
    });

    drawHUD();

    if (S.flash > 0) { // red flash on losing a life
      ctx.fillStyle = 'rgba(239,68,68,' + (S.flash / 6 * 0.25).toFixed(2) + ')';
      ctx.fillRect(0, 0, W, H);
      S.flash--;
    }
    if (S.over) drawGameOver();

    requestAnimationFrame(render);
  }

  // --- Input -----------------------------------------------------------------
  const DIRS = {
    ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
    w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0],
    W: [0, -1], S: [0, 1], A: [-1, 0], D: [1, 0],
  };

  function onKey(e) {
    if (e.key === 'Escape') { stop(); return; }
    if (S.over && (e.key === 'r' || e.key === 'R')) { start(S.tickMs); return; }
    const d = DIRS[e.key];
    if (d) {
      e.preventDefault();
      // Reject 180° reversals (instant self-collision).
      if (!(d[0] === -S.dir.x && d[1] === -S.dir.y)) S.pending = { x: d[0], y: d[1] };
    }
  }

  function onMessage(m) {
    if (!m) return;
    if (m.type === 'snake-stop') stop();
    if (m.type === 'snake-restart') start(S.tickMs || 110);
  }

  /** Full teardown: stop loops, remove nodes and listeners. */
  function stop() {
    if (!window.__snakeBooted) return;
    window.__snakeBooted = false;
    S.running = false;
    clearInterval(S.loop);
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('resize', resize);
    if (chrome.runtime && chrome.runtime.onMessage) chrome.runtime.onMessage.removeListener(onMessage);
    canvas.remove();
  }

  window.addEventListener('keydown', onKey, true);
  window.addEventListener('resize', resize);
  chrome.runtime.onMessage.addListener(onMessage);

  resize();
  chrome.storage.local.get({ snake_diff: 110, snake_best: 0 }, (r) => {
    S.best = r.snake_best || 0;
    start(Number(r.snake_diff) || 110);
    render();
  });
})();
