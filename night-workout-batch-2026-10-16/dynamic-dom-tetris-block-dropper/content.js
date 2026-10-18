/* DOM Tetris — content script (injected on demand via chrome.scripting).
 * A self-contained Tetris game rendered on a full-viewport overlay.
 * The page DOM is never touched; Esc or the exit button removes everything.
 */
(() => {
  'use strict';

  // Guard against double-injection.
  if (window.__domTetrisActive) return;
  window.__domTetrisActive = true;

  /* ------------------------------ overlay DOM ------------------------------ */
  const overlay = document.createElement('div');
  overlay.id = '__domTetrisOverlay';
  overlay.setAttribute('style', [
    'position:fixed', 'inset:0', 'z-index:2147483647',
    'display:flex', 'align-items:center', 'justify-content:center',
    'background:rgba(8,8,12,.88)', 'backdrop-filter:blur(6px)',
    'font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif',
    'user-select:none', '-webkit-user-select:none'
  ].join(';'));
  overlay.innerHTML =
    '<div style="display:flex;gap:16px;align-items:flex-start">' +
      '<canvas id="__dtBoard" width="240" height="480" style="border-radius:12px;background:#101018"></canvas>' +
      '<div style="width:172px;color:#eef;font-size:13px">' +
        '<div style="font-weight:700;font-size:15px;margin-bottom:10px">🧱 DOM Tetris</div>' +
        '<div style="margin-bottom:6px">Score <b id="__dtScore">0</b></div>' +
        '<div style="margin-bottom:6px">Level <b id="__dtLevel">1</b></div>' +
        '<div style="margin-bottom:6px">Lines <b id="__dtLines">0</b></div>' +
        '<div style="margin-bottom:6px">Best <b id="__dtBest">0</b></div>' +
        '<div style="margin:10px 0 4px;color:#9aa">Next:</div>' +
        '<canvas id="__dtNext" width="120" height="64" style="background:#101018;border-radius:8px"></canvas>' +
        '<div style="margin-top:10px;color:#9aa;line-height:1.8;font-size:12px">' +
          '←/→ move · ↓ soft drop<br>↑ rotate · Space hard drop<br>P pause · Esc exit' +
        '</div>' +
        '<button id="__dtPause" style="margin-top:10px;width:100%;padding:8px;border:none;border-radius:8px;background:#2a2a3a;color:#fff;font-weight:600;cursor:pointer">Pause</button>' +
        '<button id="__dtExit" style="margin-top:8px;width:100%;padding:8px;border:none;border-radius:8px;background:#8b5cf6;color:#fff;font-weight:600;cursor:pointer">Remove game</button>' +
        '<div id="__dtOver" style="display:none;margin-top:10px;padding:10px;background:#1a1a26;border-radius:8px;text-align:center">' +
          '<div style="font-weight:700">Game over</div>' +
          '<div id="__dtFinal" style="margin:6px 0;color:#9aa"></div>' +
          '<button id="__dtRestart" style="width:100%;padding:8px;border:none;border-radius:8px;background:#22c55e;color:#06240f;font-weight:700;cursor:pointer">Restart</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  document.documentElement.appendChild(overlay);

  const boardCanvas = overlay.querySelector('#__dtBoard');
  const ctx = boardCanvas.getContext('2d');
  const nextCanvas = overlay.querySelector('#__dtNext');
  const nctx = nextCanvas.getContext('2d');
  const elScore = overlay.querySelector('#__dtScore');
  const elLevel = overlay.querySelector('#__dtLevel');
  const elLines = overlay.querySelector('#__dtLines');
  const elBest = overlay.querySelector('#__dtBest');
  const elOver = overlay.querySelector('#__dtOver');
  const elFinal = overlay.querySelector('#__dtFinal');
  const btnPause = overlay.querySelector('#__dtPause');

  /* ------------------------------ game constants ------------------------------ */
  const COLS = 10, ROWS = 20, CELL = 24; // board is 240x480
  // Each piece is styled like a DOM node: color + tag label.
  const SHAPES = {
    I: { m: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], color: '#22d3ee', tag: '<img>' },
    O: { m: [[1,1],[1,1]], color: '#facc15', tag: '<div>' },
    T: { m: [[0,1,0],[1,1,1],[0,0,0]], color: '#c084fc', tag: '<span>' },
    S: { m: [[0,1,1],[1,1,0],[0,0,0]], color: '#4ade80', tag: '<nav>' },
    Z: { m: [[1,1,0],[0,1,1],[0,0,0]], color: '#f87171', tag: '<p>' },
    J: { m: [[1,0,0],[1,1,1],[0,0,0]], color: '#60a5fa', tag: '<btn>' },
    L: { m: [[0,0,1],[1,1,1],[0,0,0]], color: '#fb923c', tag: '<a>' }
  };
  const KEYS = Object.keys(SHAPES);
  const LINE_SCORES = [0, 100, 300, 500, 800];

  /* ------------------------------ game state ------------------------------ */
  let board, current, nextPiece, score, level, lines, best;
  let dropCounter, dropInterval, lastTime, rafId, paused, over;

  try {
    best = parseInt(window.localStorage.getItem('__domTetrisBest') || '0', 10) || 0;
  } catch (e) { best = 0; }
  elBest.textContent = best;

  function resetGame() {
    board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    score = 0; level = 1; lines = 0;
    dropCounter = 0; dropInterval = 800; lastTime = 0;
    paused = false; over = false;
    nextPiece = makePiece();
    current = makePiece();
    elOver.style.display = 'none';
    btnPause.textContent = 'Pause';
    updateHud();
  }

  function makePiece() {
    const key = KEYS[(Math.random() * KEYS.length) | 0];
    const s = SHAPES[key];
    return {
      m: s.m.map(row => row.slice()),
      color: s.color,
      tag: s.tag,
      x: 3,
      y: 0
    };
  }

  function updateHud() {
    elScore.textContent = score;
    elLevel.textContent = level;
    elLines.textContent = lines;
    elBest.textContent = best;
  }

  /* ------------------------------ core mechanics ------------------------------ */
  // True if piece matrix at (px,py) collides with walls, floor, or locked cells.
  function collides(m, px, py) {
    for (let r = 0; r < m.length; r++) {
      for (let c = 0; c < m[r].length; c++) {
        if (!m[r][c]) continue;
        const x = px + c, y = py + r;
        if (x < 0 || x >= COLS || y >= ROWS) return true;
        if (y >= 0 && board[y][x]) return true;
      }
    }
    return false;
  }

  function rotate(m) {
    const n = m.length;
    const out = Array.from({ length: n }, () => Array(n).fill(0));
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) out[c][n - 1 - r] = m[r][c];
    }
    return out;
  }

  function lockPiece() {
    const m = current.m;
    for (let r = 0; r < m.length; r++) {
      for (let c = 0; c < m[r].length; c++) {
        if (!m[r][c]) continue;
        const y = current.y + r;
        if (y < 0) { gameOver(); return; }
        board[y][current.x + c] = current.color;
      }
    }
    clearLines();
    current = nextPiece;
    nextPiece = makePiece();
    if (collides(current.m, current.x, current.y)) gameOver();
  }

  function clearLines() {
    let cleared = 0;
    for (let y = ROWS - 1; y >= 0; y--) {
      if (board[y].every(cell => cell)) {
        board.splice(y, 1);
        board.unshift(Array(COLS).fill(null));
        cleared++;
        y++; // re-check the row that fell into this index
      }
    }
    if (cleared > 0) {
      lines += cleared;
      score += LINE_SCORES[cleared] * level;
      level = Math.floor(lines / 10) + 1;
      dropInterval = Math.max(80, 800 - (level - 1) * 70);
      if (score > best) {
        best = score;
        try { window.localStorage.setItem('__domTetrisBest', String(best)); } catch (e) {}
      }
      updateHud();
    }
  }

  function stepDown() {
    if (!collides(current.m, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }

  function hardDrop() {
    while (!collides(current.m, current.x, current.y + 1)) current.y++;
    lockPiece();
    dropCounter = 0;
    updateHud();
  }

  function tryRotate() {
    const rotated = rotate(current.m);
    if (!collides(rotated, current.x, current.y)) {
      current.m = rotated;
    } else if (!collides(rotated, current.x - 1, current.y)) {
      current.m = rotated; current.x--;
    } else if (!collides(rotated, current.x + 1, current.y)) {
      current.m = rotated; current.x++;
    }
  }

  function gameOver() {
    over = true;
    elFinal.textContent = 'Score ' + score + ' · Lines ' + lines;
    elOver.style.display = 'block';
    updateHud();
  }

  /* ------------------------------ rendering ------------------------------ */
  function drawCell(g, px, py, color) {
    const pad = 1.5;
    g.fillStyle = color;
    g.beginPath();
    g.roundRect(px * CELL + pad, py * CELL + pad, CELL - pad * 2, CELL - pad * 2, 4);
    g.fill();
    // subtle top highlight for a "node" feel
    g.fillStyle = 'rgba(255,255,255,0.22)';
    g.fillRect(px * CELL + 4, py * CELL + 3, CELL - 8, 3);
  }

  function drawPiece(g, piece, offsetX, offsetY, withTag) {
    const m = piece.m;
    let minX = 99, maxX = -1, minY = 99, maxY = -1;
    for (let r = 0; r < m.length; r++) {
      for (let c = 0; c < m[r].length; c++) {
        if (!m[r][c]) continue;
        drawCell(g, offsetX + c, offsetY + r, piece.color);
        if (c < minX) minX = c; if (c > maxX) maxX = c;
        if (r < minY) minY = r; if (r > maxY) maxY = r;
      }
    }
    if (withTag && maxX >= 0) {
      // Label the falling piece with its DOM-node tag at its center.
      const cx = (offsetX + (minX + maxX + 1) / 2) * CELL;
      const cy = (offsetY + (minY + maxY + 1) / 2) * CELL;
      g.font = 'bold 9px system-ui,sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      const label = piece.tag;
      const w = g.measureText(label).width + 6;
      g.fillStyle = 'rgba(0,0,0,0.55)';
      g.beginPath();
      g.roundRect(cx - w / 2, cy - 8, w, 16, 4);
      g.fill();
      g.fillStyle = '#fff';
      g.fillText(label, cx, cy);
    }
  }

  function draw() {
    ctx.fillStyle = '#101018';
    ctx.fillRect(0, 0, boardCanvas.width, boardCanvas.height);

    // locked cells
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (board[y][x]) drawCell(ctx, x, y, board[y][x]);
      }
    }
    // falling piece, labeled like a DOM node
    if (!over) drawPiece(ctx, current, current.x, current.y, true);

    // next-piece preview
    nctx.fillStyle = '#101018';
    nctx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
    const pm = nextPiece.m;
    const pw = pm[0].length, ph = pm.length;
    const scale = Math.min(120 / (pw * CELL), 64 / (ph * CELL), 0.55);
    nctx.save();
    nctx.translate((120 - pw * CELL * scale) / 2, (64 - ph * CELL * scale) / 2);
    nctx.scale(scale, scale);
    drawPiece(nctx, nextPiece, 0, 0, false);
    nctx.restore();
  }

  /* ------------------------------ main loop ------------------------------ */
  function tick(t) {
    if (!paused && !over) {
      if (!lastTime) lastTime = t;
      const dt = t - lastTime;
      lastTime = t;
      dropCounter += dt;
      if (dropCounter >= dropInterval) {
        dropCounter = 0;
        stepDown();
      }
      draw();
    } else {
      lastTime = t; // avoid a huge dt jump after unpausing
    }
    rafId = requestAnimationFrame(tick);
  }

  /* ------------------------------ input ------------------------------ */
  function onKeyDown(e) {
    const gameKeys = ['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', ' '];
    if (gameKeys.indexOf(e.key) >= 0) e.preventDefault();
    if (e.key === 'Escape') { exit(); return; }
    if (e.key === 'p' || e.key === 'P') { togglePause(); return; }
    if (paused || over) return;
    switch (e.key) {
      case 'ArrowLeft':
        if (!collides(current.m, current.x - 1, current.y)) current.x--;
        break;
      case 'ArrowRight':
        if (!collides(current.m, current.x + 1, current.y)) current.x++;
        break;
      case 'ArrowDown':
        stepDown();
        dropCounter = 0;
        break;
      case 'ArrowUp':
        tryRotate();
        break;
      case ' ':
        hardDrop();
        break;
    }
    updateHud();
  }

  function togglePause() {
    if (over) return;
    paused = !paused;
    btnPause.textContent = paused ? 'Resume' : 'Pause';
  }

  btnPause.addEventListener('click', togglePause);
  overlay.querySelector('#__dtExit').addEventListener('click', exit);
  overlay.querySelector('#__dtRestart').addEventListener('click', resetGame);
  document.addEventListener('keydown', onKeyDown, true);

  /* ------------------------------ teardown ------------------------------ */
  function exit() {
    cancelAnimationFrame(rafId);
    document.removeEventListener('keydown', onKeyDown, true);
    overlay.remove();
    window.__domTetrisActive = false;
    window.__domTetrisExit = null;
  }
  window.__domTetrisExit = exit;

  resetGame();
  rafId = requestAnimationFrame(tick);
})();
