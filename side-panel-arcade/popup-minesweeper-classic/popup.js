/* Minefield — classic Minesweeper engine.
   First click is always safe (mines placed after it, avoiding the 3x3 around it).
   Flood-fill reveal, flags, chord-free win check, per-difficulty best times in storage.
   No network; everything on-device. */
"use strict";

const DIFFS = {
  beginner:     { rows: 9,  cols: 9,  mines: 10, label: "Beginner" },
  intermediate: { rows: 12, cols: 12, mines: 25, label: "Intermediate" },
};

const boardEl = document.getElementById("board");
const mineCountEl = document.getElementById("mineCount");
const timerEl = document.getElementById("timer");
const statusEl = document.getElementById("status");
const faceBtn = document.getElementById("face");
const diffSel = document.getElementById("difficulty");
const customRow = document.getElementById("customRow");
const bestsEl = document.getElementById("bests");

let rows, cols, mineTotal, mines, revealed, flags;
let state;           // "ready" | "playing" | "won" | "lost"
let startTime, timerId, elapsed, diffKey, customCfg;

const neighbors = (r, c) => {
  const out = [];
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) out.push([nr, nc]);
    }
  return out;
};

function newGame() {
  const d = diffKey === "custom" ? customCfg : DIFFS[diffKey];
  rows = d.rows; cols = d.cols; mineTotal = d.mines;
  mines = new Set(); revealed = new Set(); flags = new Set();
  state = "ready"; elapsed = 0;
  clearInterval(timerId);
  timerEl.textContent = "0";
  mineCountEl.textContent = mineTotal;
  statusEl.textContent = "Left-click to reveal · right-click to flag";
  statusEl.className = "status";
  setFace("smile");
  renderBoard();
}

// Place mines after the first click, never on/near the clicked cell.
function placeMines(safeR, safeC) {
  const safe = new Set([`${safeR},${safeC}`, ...neighbors(safeR, safeC).map(([r,c]) => `${r},${c}`)]);
  const spots = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if (!safe.has(`${r},${c}`)) spots.push([r, c]);
  const count = Math.min(mineTotal, spots.length);
  for (let i = spots.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [spots[i], spots[j]] = [spots[j], spots[i]];
  }
  for (let i = 0; i < count; i++) mines.add(`${spots[i][0]},${spots[i][1]}`);
}

const mineCountAt = (r, c) =>
  neighbors(r, c).filter(([nr, nc]) => mines.has(`${nr},${nc}`)).length;

function startTimer() {
  startTime = Date.now();
  timerId = setInterval(() => {
    elapsed = Math.floor((Date.now() - startTime) / 1000);
    timerEl.textContent = Math.min(elapsed, 999);
  }, 250);
}

function reveal(r, c) {
  if (state === "lost" || state === "won") return;
  const key = `${r},${c}`;
  if (revealed.has(key) || flags.has(key)) return;

  if (state === "ready") {
    placeMines(r, c);
    state = "playing";
    startTimer();
  }

  if (mines.has(key)) { lose(r, c); return; }

  // flood fill from empty cells
  const stack = [[r, c]];
  while (stack.length) {
    const [cr, cc] = stack.pop();
    const k = `${cr},${cc}`;
    if (revealed.has(k) || flags.has(k)) continue;
    revealed.add(k);
    if (mineCountAt(cr, cc) === 0)
      for (const [nr, nc] of neighbors(cr, cc))
        if (!revealed.has(`${nr},${nc}`)) stack.push([nr, nc]);
  }
  paint();
  checkWin();
}

function toggleFlag(r, c, cellEl) {
  if (state === "lost" || state === "won") return;
  const key = `${r},${c}`;
  if (revealed.has(key)) return;
  if (flags.has(key)) { flags.delete(key); cellEl.classList.remove("flag"); cellEl.innerHTML = ""; }
  else { flags.add(key); cellEl.classList.add("flag"); cellEl.innerHTML = FLAG_SVG; }
  mineCountEl.textContent = mineTotal - flags.size;
}

function checkWin() {
  if (revealed.size === rows * cols - mines.size) {
    state = "won";
    clearInterval(timerId);
    setFace("cool");
    statusEl.textContent = `You win! Cleared in ${elapsed}s.`;
    statusEl.className = "status win";
    // flag all mines for a satisfying finish
    mines.forEach(k => flags.add(k));
    mineCountEl.textContent = 0;
    paint();
    saveBest();
  }
}

function lose(hr, hc) {
  state = "lost";
  clearInterval(timerId);
  setFace("dead");
  statusEl.textContent = "Boom! Click the face to try again.";
  statusEl.className = "status lose";
  paint(true, `${hr},${hc}`);
}

async function saveBest() {
  const key = diffKey === "custom" ? "custom" : diffKey;
  const store = await chrome.storage.local.get("bestTimes");
  const bestTimes = store.bestTimes || {};
  if (!bestTimes[key] || elapsed < bestTimes[key]) {
    bestTimes[key] = elapsed;
    await chrome.storage.local.set({ bestTimes });
    renderBests(bestTimes);
  }
}

async function renderBests(cached) {
  const bestTimes = cached || (await chrome.storage.local.get("bestTimes")).bestTimes || {};
  bestsEl.innerHTML = "";
  const labels = { beginner: "Beginner 9×9", intermediate: "Intermediate 12×12", custom: "Custom" };
  let any = false;
  for (const k of ["beginner", "intermediate", "custom"]) {
    if (bestTimes[k] == null) continue;
    any = true;
    const li = document.createElement("li");
    const name = document.createElement("span"); name.textContent = labels[k];
    const t = document.createElement("span"); t.className = "t"; t.textContent = `${bestTimes[k]}s`;
    li.append(name, t); bestsEl.appendChild(li);
  }
  if (!any) bestsEl.innerHTML = '<li class="empty">No wins yet — good luck!</li>';
}

// ---- rendering ----
const FLAG_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4"/><path d="M5 4h12l-2.5 4L17 12H5"/></svg>`;
const MINE_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="6"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/></svg>`;

function setFace(mood) {
  const paths = {
    smile: `<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>`,
    cool: `<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M7 9h4M13 9h4"/>`,
    dead: `<circle cx="12" cy="12" r="10"/><path d="M8 16s1.5-2 4-2 4 2 4 2"/><path d="M9 9l6 6M15 9l-6 6"/>`,
  };
  document.getElementById("faceIcon").innerHTML = paths[mood];
}

function renderBoard() {
  boardEl.innerHTML = "";
  boardEl.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  const maxW = 348; // 380 popup - padding
  const size = Math.min(34, Math.floor(maxW / cols));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.style.width = cell.style.height = `${size}px`;
      cell.style.fontSize = `${Math.max(10, size * 0.42)}px`;
      cell.dataset.r = r; cell.dataset.c = c;
      cell.addEventListener("click", () => reveal(r, c));
      cell.addEventListener("contextmenu", (e) => { e.preventDefault(); toggleFlag(r, c, cell); });
      boardEl.appendChild(cell);
    }
  }
}

function paint(showMines = false, hitKey = null) {
  for (const cell of boardEl.children) {
    const r = +cell.dataset.r, c = +cell.dataset.c, key = `${r},${c}`;
    cell.classList.remove("open", "mine-hit", "mine");
    cell.innerHTML = "";
    if (revealed.has(key)) {
      cell.classList.add("open");
      const n = mineCountAt(r, c);
      if (n) { cell.textContent = n; cell.classList.add(`n${n}`); }
    } else if (flags.has(key)) {
      cell.classList.add("flag");
      cell.innerHTML = FLAG_SVG;
    } else if (showMines && mines.has(key)) {
      cell.classList.add("mine");
      cell.innerHTML = MINE_SVG;
      if (key === hitKey) cell.classList.add("mine-hit");
    }
  }
}

// ---- controls ----
faceBtn.addEventListener("click", newGame);

diffSel.addEventListener("change", () => {
  diffKey = diffSel.value;
  customRow.classList.toggle("hidden", diffKey !== "custom");
  newGame();
});

document.getElementById("cApply").addEventListener("click", () => {
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v || lo));
  const r = clamp(+document.getElementById("cRows").value, 5, 16);
  const c = clamp(+document.getElementById("cCols").value, 5, 16);
  const maxMines = Math.floor(r * c * 0.4);
  const m = clamp(+document.getElementById("cMines").value, 5, maxMines);
  document.getElementById("cMines").value = m;
  customCfg = { rows: r, cols: c, mines: m, label: "Custom" };
  newGame();
});

// ---- init ----
diffKey = "beginner";
customCfg = { rows: 10, cols: 10, mines: 15, label: "Custom" };
newGame();
renderBests();
