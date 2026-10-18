/* TetraFall — full Tetris engine: 7 tetrominoes, SRS-lite rotation, ghost piece,
   hold queue, 3-piece preview, scoring, levels, pause, game over, local high scores.
   All state stays in memory + chrome.storage.local. No network. */
"use strict";

const COLS = 10, ROWS = 20, CELL = 30; // board canvas is 300x600

// Tetromino definitions: matrix + accent color per piece
const PIECES = {
  I: { color: "#22d3ee", cells: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]] },
  J: { color: "#60a5fa", cells: [[1,0,0],[1,1,1],[0,0,0]] },
  L: { color: "#fb923c", cells: [[0,0,1],[1,1,1],[0,0,0]] },
  O: { color: "#facc15", cells: [[1,1],[1,1]] },
  S: { color: "#4ade80", cells: [[0,1,1],[1,1,0],[0,0,0]] },
  T: { color: "#c084fc", cells: [[0,1,0],[1,1,1],[0,0,0]] },
  Z: { color: "#f87171", cells: [[1,1,0],[0,1,1],[0,0,0]] },
};
const BAG = Object.keys(PIECES);
const LINE_SCORES = [0, 100, 300, 500, 800]; // per lines cleared, x level

const board = document.getElementById("board");
const bctx = board.getContext("2d");
const holdCanvas = document.getElementById("holdCanvas");
const hctx = holdCanvas.getContext("2d");
const nextCanvas = document.getElementById("nextCanvas");
const nctx = nextCanvas.getContext("2d");
const overlay = document.getElementById("overlay");
const ovTitle = document.getElementById("ovTitle");
const ovText = document.getElementById("ovText");
const ovBtn = document.getElementById("ovBtn");
const scoreEl = document.getElementById("score");
const levelEl = document.getElementById("level");
const linesEl = document.getElementById("lines");

// ---- state ----
let grid, current, bag, queue, hold, canHold;
let score, lines, level, dropInterval, lastDrop, paused, over, rafId;

function emptyGrid() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function newBag() {
  const b = [...BAG];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

function spawnPiece(type) {
  const def = PIECES[type];
  return {
    type,
    color: def.color,
    matrix: def.cells.map(r => [...r]),
    x: Math.floor(COLS / 2) - Math.ceil(def.cells[0].length / 2),
    y: type === "I" ? -1 : 0,
  };
}

function refillQueue() {
  while (queue.length < 7) queue.push(...newBag());
}

function nextPiece() {
  refillQueue();
  return spawnPiece(queue.shift());
}

// ---- collision / rotation ----
function collides(matrix, px, py) {
  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix[r].length; c++) {
      if (!matrix[r][c]) continue;
      const x = px + c, y = py + r;
      if (x < 0 || x >= COLS || y >= ROWS) return true;
      if (y >= 0 && grid[y][x]) return true;
    }
  }
  return false;
}

function rotateMatrix(m) {
  const n = m.length;
  const out = Array.from({ length: n }, () => Array(n).fill(0));
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) out[c][n - 1 - r] = m[r][c];
  return out;
}

// SRS-lite wall kicks: try no shift, then +-1, +-2 horizontally, then up one
function rotateCurrent() {
  if (!current || paused || over) return;
  if (current.type === "O") return;
  const rotated = rotateMatrix(current.matrix);
  const kicks = [[0,0],[-1,0],[1,0],[-2,0],[2,0],[0,-1]];
  for (const [dx, dy] of kicks) {
    if (!collides(rotated, current.x + dx, current.y + dy)) {
      current.matrix = rotated;
      current.x += dx; current.y += dy;
      draw();
      return;
    }
  }
}

function ghostY() {
  let y = current.y;
  while (!collides(current.matrix, current.x, y + 1)) y++;
  return y;
}

function move(dx) {
  if (!current || paused || over) return;
  if (!collides(current.matrix, current.x + dx, current.y)) {
    current.x += dx;
    draw();
  }
}

function softDrop() {
  if (!current || paused || over) return;
  if (!collides(current.matrix, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHud();
    draw();
  } else {
    lockPiece();
  }
}

function hardDrop() {
  if (!current || paused || over) return;
  const target = ghostY();
  score += 2 * (target - current.y);
  current.y = target;
  updateHud();
  lockPiece();
}

function holdPiece() {
  if (!current || paused || over || !canHold) return;
  const t = current.type;
  current = hold ? spawnPiece(hold) : nextPiece();
  hold = t;
  canHold = false;
  if (collides(current.matrix, current.x, current.y)) gameOver();
  draw();
}

function lockPiece() {
  for (let r = 0; r < current.matrix.length; r++) {
    for (let c = 0; c < current.matrix[r].length; c++) {
      if (!current.matrix[r][c]) continue;
      const y = current.y + r;
      if (y < 0) { gameOver(); return; }
      grid[y][current.x + c] = current.color;
    }
  }
  clearLines();
  current = nextPiece();
  canHold = true;
  if (collides(current.matrix, current.x, current.y)) gameOver();
  draw();
}

function clearLines() {
  let cleared = 0;
  for (let y = ROWS - 1; y >= 0; y--) {
    if (grid[y].every(cell => cell)) {
      grid.splice(y, 1);
      grid.unshift(Array(COLS).fill(null));
      cleared++;
      y++; // re-check the row that fell into this index
    }
  }
  if (cleared) {
    score += LINE_SCORES[cleared] * level;
    lines += cleared;
    const newLevel = Math.floor(lines / 10) + 1;
    if (newLevel !== level) {
      level = newLevel;
      dropInterval = Math.max(60, 800 - (level - 1) * 70);
    }
    updateHud();
  }
}

// ---- rendering ----
function drawCell(ctx, x, y, size, color, alpha = 1, ghost = false) {
  ctx.save();
  ctx.globalAlpha = alpha;
  const pad = 1;
  ctx.fillStyle = ghost ? "transparent" : color;
  if (ghost) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x * size + pad, y * size + pad, size - pad * 2, size - pad * 2);
  } else {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x * size + pad, y * size + pad, size - pad * 2, size - pad * 2, 5);
    ctx.fill();
    // glossy top highlight
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.beginPath();
    ctx.roundRect(x * size + pad + 3, y * size + pad + 3, size - pad * 2 - 6, 7, 3);
    ctx.fill();
  }
  ctx.restore();
}

function drawPieceOn(ctx, piece, ox, oy, size, ghost = false, alpha = 1) {
  piece.matrix.forEach((row, r) =>
    row.forEach((v, c) => {
      if (v) drawCell(ctx, ox + c, oy + r, size, piece.color, alpha, ghost);
    }));
}

function draw() {
  bctx.clearRect(0, 0, board.width, board.height);
  // settled blocks
  grid.forEach((row, y) =>
    row.forEach((color, x) => { if (color) drawCell(bctx, x, y, CELL, color); }));
  if (current && !over) {
    drawPieceOn(bctx, { ...current, matrix: current.matrix }, current.x, ghostY(), CELL, true);
    drawPieceOn(bctx, current, current.x, current.y, CELL);
  }
  // hold preview
  hctx.clearRect(0, 0, holdCanvas.width, holdCanvas.height);
  if (hold) {
    const p = spawnPiece(hold);
    const w = p.matrix[0].length;
    drawPieceOn(hctx, p, (4 - w) / 2, 0.5, 24);
  }
  // next previews (3)
  nctx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  queue.slice(0, 3).forEach((t, i) => {
    const p = spawnPiece(t);
    const w = p.matrix[0].length;
    drawPieceOn(nctx, p, (4 - w) / 2, i * 2.6 + 0.4, 24);
  });
}

function updateHud() {
  scoreEl.textContent = score.toLocaleString();
  levelEl.textContent = level;
  linesEl.textContent = lines;
}

// ---- game flow ----
function showOverlay(title, text, btnLabel) {
  ovTitle.textContent = title;
  ovText.textContent = text;
  ovBtn.textContent = btnLabel;
  overlay.classList.remove("hidden");
}
function hideOverlay() { overlay.classList.add("hidden"); }

function reset() {
  grid = emptyGrid();
  bag = [];
  queue = [];
  refillQueue();
  current = nextPiece();
  hold = null; canHold = true;
  score = 0; lines = 0; level = 1;
  dropInterval = 800; lastDrop = performance.now();
  paused = false; over = false;
  hideOverlay();
  updateHud();
  draw();
}

async function saveHighScore() {
  const entry = { score, level, lines, date: new Date().toISOString().slice(0, 10) };
  const { highScores = [] } = await chrome.storage.local.get("highScores");
  highScores.push(entry);
  highScores.sort((a, b) => b.score - a.score);
  await chrome.storage.local.set({ highScores: highScores.slice(0, 10) });
}

function gameOver() {
  over = true;
  cancelAnimationFrame(rafId);
  saveHighScore();
  showOverlay("Game Over", `Score ${score.toLocaleString()} · Level ${level} · ${lines} lines`, "New game");
}

function togglePause() {
  if (over) return;
  paused = !paused;
  if (paused) {
    cancelAnimationFrame(rafId);
    showOverlay("Paused", "Press P to resume", "Resume");
  } else {
    hideOverlay();
    lastDrop = performance.now();
    loop();
  }
}

function loop(now = performance.now()) {
  if (paused || over) return;
  if (now - lastDrop >= dropInterval) {
    lastDrop = now;
    if (!collides(current.matrix, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
    draw();
  }
  rafId = requestAnimationFrame(loop);
}

// ---- input ----
const keyHandlers = {
  ArrowLeft: () => move(-1),
  ArrowRight: () => move(1),
  ArrowDown: () => softDrop(),
  ArrowUp: () => rotateCurrent(),
  z: () => rotateCurrent(),
  Z: () => rotateCurrent(),
  " ": () => hardDrop(),
  c: () => holdPiece(),
  C: () => holdPiece(),
  p: () => togglePause(),
  P: () => togglePause(),
  n: () => { reset(); loop(); },
  N: () => { reset(); loop(); },
};

document.addEventListener("keydown", (e) => {
  if (["ArrowLeft","ArrowRight","ArrowDown","ArrowUp"," "].includes(e.key)) e.preventDefault();
  const fn = keyHandlers[e.key];
  if (fn) fn();
});

ovBtn.addEventListener("click", () => { reset(); loop(); });

reset();
loop();
