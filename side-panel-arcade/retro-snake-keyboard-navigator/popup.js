'use strict';
/* SnakeByte — classic snake on canvas. All logic self-contained; high score in chrome.storage.local. */

/* ---------- Config ---------- */
const COLS = 20;            // grid columns
const ROWS = 17;            // grid rows
const CELL = 17;            // px per cell (canvas is 340x289; CSS scales to fit)
const BASE_TICK = 150;      // starting interval (ms)
const MIN_TICK = 70;        // fastest interval (ms)
const SPEED_STEP = 8;       // ms faster per food eaten
const ACCENT = '#a3e635';

const canvas = document.getElementById('board');
canvas.width = COLS * CELL;   // 340
canvas.height = ROWS * CELL;  // 289
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayText = document.getElementById('overlay-text');
const startBtn = document.getElementById('start-btn');
const pauseBtn = document.getElementById('pause-btn');
const restartBtn = document.getElementById('restart-btn');
const speedBtn = document.getElementById('speed-btn');
const speedLabel = document.getElementById('speed-label');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const levelChip = document.getElementById('level-chip');

/* ---------- State ---------- */
let snake, dir, pendingDir, food, score, best, level;
let timer = null, running = false, gameOver = false;
let speedMult = 1; // user-selected 1x / 2x

const KEYMAP = {
  ArrowUp: 'up', w: 'up', W: 'up',
  ArrowDown: 'down', s: 'down', S: 'down',
  ArrowLeft: 'left', a: 'left', A: 'left',
  ArrowRight: 'right', d: 'right', D: 'right',
};
const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };
const VEC = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

/* ---------- Storage ---------- */
function loadBest() {
  chrome.storage.local.get({ snakeBest: 0 }, (res) => {
    best = res.snakeBest || 0;
    bestEl.textContent = best;
  });
}
function saveBest() {
  if (score > best) {
    best = score;
    bestEl.textContent = best;
    chrome.storage.local.set({ snakeBest: best });
  }
}

/* ---------- Game setup ---------- */
function reset() {
  snake = [{ x: 9, y: 8 }, { x: 8, y: 8 }, { x: 7, y: 8 }];
  dir = 'right';
  pendingDir = 'right';
  score = 0;
  level = 1;
  scoreEl.textContent = '0';
  levelChip.hidden = true;
  placeFood();
  gameOver = false;
}

function placeFood() {
  // Pick a cell not occupied by the snake.
  const occupied = new Set(snake.map((s) => s.y * COLS + s.x));
  const free = [];
  for (let i = 0; i < COLS * ROWS; i++) if (!occupied.has(i)) free.push(i);
  if (!free.length) return; // board full — effectively a win
  const pick = free[Math.floor(Math.random() * free.length)];
  food = { x: pick % COLS, y: Math.floor(pick / COLS) };
}

/* ---------- Loop ---------- */
function tickMs() {
  return Math.max(MIN_TICK, (BASE_TICK - score * SPEED_STEP / 10) / speedMult);
}

function start() {
  if (running) return;
  running = true;
  overlay.classList.add('hidden');
  levelChip.hidden = false;
  schedule();
}

function schedule() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    if (!running) return;
    step();
    schedule();
  }, tickMs());
}

function step() {
  dir = pendingDir;
  const [dx, dy] = VEC[dir];
  const head = { x: snake[0].x + dx, y: snake[0].y + dy };

  // Wall or self collision → game over.
  if (
    head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS ||
    snake.some((s) => s.x === head.x && s.y === head.y)
  ) {
    endGame();
    return;
  }

  snake.unshift(head);
  if (head.x === food.x && head.y === food.y) {
    score += 10;
    scoreEl.textContent = score;
    const newLevel = 1 + Math.floor(score / 100);
    if (newLevel !== level) {
      level = newLevel;
      levelChip.textContent = 'Level ' + level;
      flashLevel();
    }
    placeFood();
  } else {
    snake.pop();
  }
  draw();
}

function endGame() {
  running = false;
  gameOver = true;
  clearTimeout(timer);
  saveBest();
  overlayTitle.textContent = 'Game over';
  overlayText.innerHTML = 'You scored <strong>' + score + '</strong> points.';
  startBtn.textContent = 'Play again';
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  if (running) {
    running = false;
    clearTimeout(timer);
    overlayTitle.textContent = 'Paused';
    overlayText.innerHTML = 'Press <kbd>Space</kbd> to resume.';
    startBtn.textContent = 'Resume';
    overlay.classList.remove('hidden');
  } else {
    start();
  }
}

function flashLevel() {
  levelChip.animate(
    [{ transform: 'scale(1.25)' }, { transform: 'scale(1)' }],
    { duration: 300, easing: 'ease-out' }
  );
}

/* ---------- Rendering ---------- */
function draw() {
  ctx.fillStyle = '#0d1210';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Subtle grid dots.
  ctx.fillStyle = 'rgba(163,230,53,0.05)';
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++)
      ctx.fillRect(x * CELL + CELL / 2 - 1, y * CELL + CELL / 2 - 1, 2, 2);

  // Food — pulsing red apple-ish dot.
  const pulse = 5 + Math.sin(Date.now() / 200) * 1.5;
  ctx.fillStyle = '#f87171';
  ctx.beginPath();
  ctx.arc(food.x * CELL + CELL / 2, food.y * CELL + CELL / 2, pulse, 0, Math.PI * 2);
  ctx.fill();

  // Snake — head bright, body fading.
  snake.forEach((seg, i) => {
    const t = i / Math.max(snake.length - 1, 1);
    const alpha = 1 - t * 0.55;
    ctx.fillStyle = i === 0 ? ACCENT : `rgba(163,230,53,${alpha.toFixed(2)})`;
    const pad = i === 0 ? 1 : 2;
    ctx.beginPath();
    ctx.roundRect(seg.x * CELL + pad, seg.y * CELL + pad, CELL - pad * 2, CELL - pad * 2, 4);
    ctx.fill();
  });

  // Eyes on the head.
  const h = snake[0];
  const [dx, dy] = VEC[dir];
  const ex = h.x * CELL + CELL / 2 + dx * 3;
  const ey = h.y * CELL + CELL / 2 + dy * 3;
  ctx.fillStyle = '#0b0e11';
  const perp = dir === 'up' || dir === 'down' ? [1, 0] : [0, 1];
  [[1, 0], [-1, 0]].forEach(([s]) => {
    ctx.beginPath();
    ctx.arc(ex + perp[0] * s * 4, ey + perp[1] * s * 4, 2, 0, Math.PI * 2);
    ctx.fill();
  });
}

/* ---------- Input ---------- */
document.addEventListener('keydown', (e) => {
  if (e.key === ' ') {
    e.preventDefault();
    if (gameOver) { reset(); draw(); start(); } else togglePause();
    return;
  }
  if (e.key === 'r' || e.key === 'R') {
    reset(); draw(); start();
    return;
  }
  const mapped = KEYMAP[e.key];
  if (mapped) {
    e.preventDefault();
    if (mapped !== OPPOSITE[dir]) pendingDir = mapped;
    if (!running && !gameOver) start();
  }
});

startBtn.addEventListener('click', () => {
  if (gameOver) { reset(); draw(); }
  start();
});
pauseBtn.addEventListener('click', togglePause);
restartBtn.addEventListener('click', () => { reset(); draw(); start(); });
speedBtn.addEventListener('click', () => {
  speedMult = speedMult === 1 ? 2 : 1;
  speedLabel.textContent = 'Speed: ' + speedMult + '×';
  if (running) schedule();
});

/* ---------- Init ---------- */
reset();
loadBest();
draw();
