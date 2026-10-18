// Minesweeper Sandbox — classic minesweeper, fully in-popup.
// State: board of cell objects; first click is always safe (mines placed after).

'use strict';

// ---------- config ----------
const DIFFS = {
  easy:   { rows: 9,  cols: 9,  mines: 10 },
  medium: { rows: 16, cols: 16, mines: 40 },
  hard:   { rows: 16, cols: 30, mines: 99 },
};
const DIRS = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];

// ---------- state ----------
let diff = 'easy', rows, cols, mineTotal;
let grid = [];          // rows x cols -> {mine, open, flag, adj}
let started = false, over = false, won = false;
let timerId = null, seconds = 0;
let flagMode = false;
let minesPlaced = false;

// ---------- dom ----------
const $ = id => document.getElementById(id);
const boardEl = $('board'), mineEl = $('mineCount'), timerEl = $('timer');
const bannerEl = $('banner'), bestEl = $('best');

// ---------- helpers ----------
const key = (r, c) => r * cols + c;
const inB = (r, c) => r >= 0 && r < rows && c >= 0 && c < cols;
const bestKey = () => `ms_best_${diff}`;

async function loadBest() {
  const v = await chrome.storage.local.get(bestKey());
  bestEl.textContent = v[bestKey()] != null ? v[bestKey()] + 's' : '–';
}

// ---------- game setup ----------
function newGame(newDiff) {
  if (newDiff) diff = newDiff;
  const cfg = DIFFS[diff];
  ({ rows, cols, mines: mineTotal } = cfg);
  grid = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ mine: false, open: false, flag: false, adj: 0 })));
  started = false; over = false; won = false; minesPlaced = false;
  seconds = 0; clearInterval(timerId);
  timerEl.textContent = '0'; mineEl.textContent = mineTotal;
  bannerEl.className = 'banner hidden'; bannerEl.textContent = '';
  document.querySelectorAll('.diff').forEach(b =>
    b.classList.toggle('active', b.dataset.diff === diff));
  renderBoard();
  loadBest();
}

function renderBoard() {
  boardEl.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  boardEl.innerHTML = '';
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const d = document.createElement('div');
    d.className = 'cell'; d.dataset.r = r; d.dataset.c = c;
    d.addEventListener('click', () => flagMode ? toggleFlag(r, c) : reveal(r, c));
    d.addEventListener('contextmenu', e => { e.preventDefault(); toggleFlag(r, c); });
    boardEl.appendChild(d);
  }
}

// Place mines after first click so it never hits a mine.
function placeMines(safeR, safeC) {
  const banned = new Set([key(safeR, safeC)]);
  DIRS.forEach(([dr, dc]) => { if (inB(safeR + dr, safeC + dc)) banned.add(key(safeR + dr, safeC + dc)); });
  let placed = 0;
  while (placed < mineTotal) {
    const r = Math.floor(Math.random() * rows), c = Math.floor(Math.random() * cols);
    if (banned.has(key(r, c)) || grid[r][c].mine) continue;
    grid[r][c].mine = true; placed++;
  }
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (grid[r][c].mine) continue;
    grid[r][c].adj = DIRS.filter(([dr, dc]) => inB(r + dr, c + dc) && grid[r + dr][c + dc].mine).length;
  }
}

// ---------- actions ----------
function startTimer() {
  if (timerId) return;
  timerId = setInterval(() => { seconds++; timerEl.textContent = seconds; }, 1000);
}

function reveal(r, c) {
  if (over || grid[r][c].open || grid[r][c].flag) return;
  if (!minesPlaced) { placeMines(r, c); minesPlaced = true; }
  if (!started) { started = true; startTimer(); }
  const cell = grid[r][c];
  if (cell.mine) return gameOver(r, c);
  flood(r, c);
  paint();
  checkWin();
}

function flood(r, c) {
  const stack = [[r, c]];
  while (stack.length) {
    const [cr, cc] = stack.pop();
    const cell = grid[cr][cc];
    if (cell.open || cell.flag || cell.mine) continue;
    cell.open = true;
    if (cell.adj === 0) DIRS.forEach(([dr, dc]) => {
      const nr = cr + dr, nc = cc + dc;
      if (inB(nr, nc) && !grid[nr][nc].open) stack.push([nr, nc]);
    });
  }
}

function toggleFlag(r, c) {
  if (over || grid[r][c].open) return;
  if (!started) { started = true; startTimer(); }
  grid[r][c].flag = !grid[r][c].flag;
  paint();
}

function paint() {
  let flagged = 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const cell = grid[r][c], el = boardEl.children[r * cols + c];
    el.className = 'cell';
    el.textContent = '';
    if (cell.open) {
      el.classList.add('open');
      if (cell.mine) { el.classList.add('mine'); el.textContent = '💣'; }
      else if (cell.adj > 0) { el.classList.add('n' + cell.adj); el.textContent = cell.adj; }
    } else if (cell.flag) { el.classList.add('flag'); el.textContent = '🚩'; flagged++; }
  }
  mineEl.textContent = mineTotal - flagged;
}

function revealAllMines(hitR, hitC) {
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const cell = grid[r][c], el = boardEl.children[r * cols + c];
    if (cell.mine) { el.classList.add('open', 'mine'); el.textContent = (r === hitR && c === hitC) ? '💥' : '💣'; }
  }
}

function gameOver(r, c) {
  over = true; clearInterval(timerId);
  revealAllMines(r, c);
  bannerEl.className = 'banner lose';
  bannerEl.textContent = '💥 Boom! Click New game to retry.';
}

async function checkWin() {
  const open = grid.flat().filter(x => x.open).length;
  if (open === rows * cols - mineTotal) {
    over = true; won = true; clearInterval(timerId);
    bannerEl.className = 'banner win';
    bannerEl.textContent = `🏆 You cleared it in ${seconds}s!`;
    const k = bestKey(), cur = (await chrome.storage.local.get(k))[k];
    if (cur == null || seconds < cur) {
      await chrome.storage.local.set({ [k]: seconds });
      bannerEl.textContent += ' New best!';
      bestEl.textContent = seconds + 's';
    }
  }
}

// ---------- events ----------
document.querySelectorAll('.diff').forEach(b =>
  b.addEventListener('click', () => newGame(b.dataset.diff)));
$('newGame').addEventListener('click', () => newGame());
$('flagToggle').addEventListener('click', () => {
  flagMode = !flagMode;
  $('flagToggle').classList.toggle('on', flagMode);
});
document.addEventListener('keydown', e => {
  if (e.key === 'n' || e.key === 'N') newGame();
  if (e.key === 'f' || e.key === 'F') $('flagToggle').click();
});

newGame('easy');
