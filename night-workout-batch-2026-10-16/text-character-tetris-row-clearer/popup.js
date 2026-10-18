// Glyph Tetris — tetris in the popup where every block cell is drawn
// as a text character from a user-customizable glyph set.
// 7-bag randomizer, SRS-ish kickless rotation, levels speed up.

'use strict';

// ---------- constants ----------
const COLS = 10, ROWS = 20, CELL = 20;
const SHAPES = {  // matrices of 1s
  I: [[1,1,1,1]],
  J: [[1,0,0],[1,1,1]],
  L: [[0,0,1],[1,1,1]],
  O: [[1,1],[1,1]],
  S: [[0,1,1],[1,1,0]],
  T: [[0,1,0],[1,1,1]],
  Z: [[1,1,0],[0,1,1]],
};
const COLORS = {
  I:'#22d3ee', J:'#60a5fa', L:'#fb923c', O:'#facc15',
  S:'#4ade80', T:'#c084fc', Z:'#f87171',
};
const SCORES = [0, 100, 300, 500, 800];

// ---------- state ----------
let board, piece, bag, score, lines, level, dropMs, lastDrop;
let over = false, paused = false, started = false;
let glyphSet = '█▓▒░#@$%&*+?';

// ---------- dom ----------
const $ = id => document.getElementById(id);
const cv = $('board'), cx = cv.getContext('2d');
const nv = $('next'), nx = nv.getContext('2d');

function emptyBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function newBag() {
  const keys = Object.keys(SHAPES);
  for (let i = keys.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [keys[i], keys[j]] = [keys[j], keys[i]];
  }
  return keys;
}

function spawn() {
  if (!bag.length) bag = newBag();
  const type = bag.pop();
  const m = SHAPES[type];
  piece = {
    type, m: m.map(r => r.slice()),
    x: Math.floor(COLS / 2) - Math.ceil(m[0].length / 2),
    y: 0,
  };
  if (collides(piece)) { over = true; drawBoard(); }
}

function collides(p, dx = 0, dy = 0, mat = null) {
  const m = mat || p.m;
  for (let r = 0; r < m.length; r++) for (let c = 0; c < m[r].length; c++) {
    if (!m[r][c]) continue;
    const x = p.x + c + dx, y = p.y + r + dy;
    if (x < 0 || x >= COLS || y >= ROWS) return true;
    if (y >= 0 && board[y][x]) return true;
  }
  return false;
}

function rotate(m) {
  return m[0].map((_, c) => m.map(r => r[c]).reverse());
}

function lock() {
  piece.m.forEach((row, r) => row.forEach((v, c) => {
    if (v && piece.y + r >= 0) board[piece.y + r][piece.x + c] = piece.type;
  }));
  clearLines();
  spawn();
}

function clearLines() {
  let n = 0;
  board = board.filter(row => {
    if (row.every(v => v)) { n++; return false; }
    return true;
  });
  while (board.length < ROWS) board.unshift(Array(COLS).fill(null));
  if (n) {
    lines += n;
    score += SCORES[n] * level;
    const nl = Math.floor(lines / 10) + 1;
    if (nl > level) { level = nl; dropMs = Math.max(80, 800 - (level - 1) * 70); }
    updateHud();
  }
}

// ---------- drawing (glyph blocks) ----------
function glyphFor(type) {
  const i = Object.keys(SHAPES).indexOf(type);
  return glyphSet[i % glyphSet.length] || '█';
}

function drawCell(g, x, y, type, ghost = false) {
  g.font = `${CELL - 2}px monospace`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.globalAlpha = ghost ? 0.25 : 1;
  g.fillStyle = COLORS[type];
  g.fillText(glyphFor(type), x * CELL + CELL / 2, y * CELL + CELL / 2);
  g.globalAlpha = 1;
}

function ghostY() {
  let y = piece.y;
  while (!collides(piece, 0, y - piece.y + 1)) y++;
  return y;
}

function drawBoard() {
  cx.clearRect(0, 0, cv.width, cv.height);
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++)
    if (board[r][c]) drawCell(cx, c, r, board[r][c]);
  if (piece && !over) {
    const gy = ghostY(), keep = piece.y;
    piece.y = gy;
    piece.m.forEach((row, r) => row.forEach((v, c) => { if (v) drawCell(cx, piece.x + c, piece.y + r, piece.type, true); }));
    piece.y = keep;
    piece.m.forEach((row, r) => row.forEach((v, c) => { if (v && piece.y + r >= 0) drawCell(cx, piece.x + c, piece.y + r, piece.type); }));
  }
  if (over) {
    cx.fillStyle = 'rgba(0,0,0,.6)'; cx.fillRect(0, 0, cv.width, cv.height);
    cx.fillStyle = '#f87171'; cx.font = 'bold 18px system-ui'; cx.textAlign = 'center';
    cx.fillText('GAME OVER', cv.width / 2, cv.height / 2);
  }
  if (paused && !over) {
    cx.fillStyle = 'rgba(0,0,0,.5)'; cx.fillRect(0, 0, cv.width, cv.height);
    cx.fillStyle = '#fff'; cx.font = 'bold 16px system-ui'; cx.textAlign = 'center';
    cx.fillText('PAUSED', cv.width / 2, cv.height / 2);
  }
  // next piece
  nx.clearRect(0, 0, nv.width, nv.height);
  if (bag.length) {
    const nt = bag[bag.length - 1], m = SHAPES[nt];
    const cw = 18;
    nx.font = `${cw - 2}px monospace`; nx.textAlign = 'center'; nx.textBaseline = 'middle';
    nx.fillStyle = COLORS[nt];
    const i = Object.keys(SHAPES).indexOf(nt), g = glyphSet[i % glyphSet.length] || '█';
    m.forEach((row, r) => row.forEach((v, c) => {
      if (v) nx.fillText(g, 20 + c * cw, 20 + r * cw);
    }));
  }
}

// ---------- loop ----------
function tick(ts) {
  if (started && !over && !paused) {
    if (!lastDrop) lastDrop = ts;
    if (ts - lastDrop > dropMs) {
      lastDrop = ts;
      if (!collides(piece, 0, 1)) piece.y++;
      else lock();
      drawBoard();
    }
  }
  requestAnimationFrame(tick);
}

// ---------- game control ----------
function start() {
  board = emptyBoard(); bag = newBag();
  score = 0; lines = 0; level = 1; dropMs = 800; lastDrop = 0;
  over = false; paused = false; started = true;
  updateHud();
  spawn(); drawBoard();
  $('pauseBtn').textContent = 'Pause';
}

function updateHud() {
  $('score').textContent = score;
  $('level').textContent = level;
  $('lines').textContent = lines;
}

async function loadBest() {
  const v = await chrome.storage.local.get('tetris_best');
  $('best').textContent = v.tetris_best || 0;
}
async function maybeSaveBest() {
  const v = await chrome.storage.local.get('tetris_best');
  if (score > (v.tetris_best || 0)) {
    await chrome.storage.local.set({ tetris_best: score });
    $('best').textContent = score;
  }
}

// ---------- input ----------
document.addEventListener('keydown', e => {
  if (!started || over) { if (e.key === 'Enter') start(); return; }
  const k = e.key;
  if (['ArrowLeft','ArrowRight','ArrowDown',' '].includes(k)) e.preventDefault();
  if (k === 'p' || k === 'P') return togglePause();
  if (paused) return;
  if (k === 'ArrowLeft' && !collides(piece, -1, 0)) piece.x--;
  else if (k === 'ArrowRight' && !collides(piece, 1, 0)) piece.x++;
  else if (k === 'ArrowDown' && !collides(piece, 0, 1)) { piece.y++; score += 1; }
  else if (k === 'ArrowUp') {
    const r = rotate(piece.m);
    if (!collides(piece, 0, 0, r)) piece.m = r;
  }
  else if (k === ' ') { while (!collides(piece, 0, 1)) { piece.y++; score += 2; } lock(); }
  else return;
  if (over) maybeSaveBest();
  updateHud(); drawBoard();
});

function togglePause() {
  if (!started || over) return;
  paused = !paused;
  $('pauseBtn').textContent = paused ? 'Resume' : 'Pause';
  drawBoard();
}

$('startBtn').addEventListener('click', start);
$('pauseBtn').addEventListener('click', togglePause);
$('glyphs').addEventListener('change', e => {
  glyphSet = e.target.value || '█';
  chrome.storage.local.set({ tetris_glyphs: glyphSet });
  drawBoard();
});

// ---------- init ----------
(async () => {
  const v = await chrome.storage.local.get(['tetris_glyphs', 'tetris_best']);
  if (v.tetris_glyphs) { glyphSet = v.tetris_glyphs; $('glyphs').value = glyphSet; }
  $('best').textContent = v.tetris_best || 0;
  board = emptyBoard(); drawBoard();
  requestAnimationFrame(tick);
})();
