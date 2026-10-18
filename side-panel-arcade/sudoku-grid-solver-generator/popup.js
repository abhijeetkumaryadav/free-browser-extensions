// Sudoku Grid — solver + generator. All logic on-device; state in chrome.storage.local.
//
// ---- Backtracking core ----
function findEmpty(g) {
  for (let i = 0; i < 81; i++) if (g[i] === 0) return i;
  return -1;
}
function candidates(g, i) {
  const row = Math.floor(i / 9), col = i % 9;
  const used = new Set();
  for (let c = 0; c < 9; c++) used.add(g[row * 9 + c]);
  for (let r = 0; r < 9; r++) used.add(g[r * 9 + col]);
  const br = row - (row % 3), bc = col - (col % 3);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) used.add(g[(br + r) * 9 + bc + c]);
  const out = [];
  for (let n = 1; n <= 9; n++) if (!used.has(n)) out.push(n);
  return out;
}
// Solve in place; returns {solved, steps}. `limit` caps recursion for uniqueness counting.
function solveGrid(g, stats) {
  const i = findEmpty(g);
  if (i === -1) return true;
  const cands = candidates(g, i);
  for (const n of cands) {
    if (stats) stats.steps++;
    g[i] = n;
    if (solveGrid(g, stats)) return true;
    g[i] = 0;
  }
  return false;
}
// Count solutions up to `cap` (used for uniqueness checks).
function countSolutions(g, cap) {
  const i = findEmpty(g);
  if (i === -1) return 1;
  let total = 0;
  for (const n of candidates(g, i)) {
    g[i] = n;
    total += countSolutions(g, cap);
    g[i] = 0;
    if (total >= cap) return total;
  }
  return total;
}
function shuffled(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
// Full random solved grid via randomized backtracking.
function fullGrid() {
  const g = new Array(81).fill(0);
  (function fill() {
    const i = findEmpty(g);
    if (i === -1) return true;
    for (const n of shuffled([1,2,3,4,5,6,7,8,9])) {
      if (candidates(g, i).includes(n)) {
        g[i] = n;
        if (fill()) return true;
        g[i] = 0;
      }
    }
    return false;
  })();
  return g;
}
// Dig holes while preserving a unique solution; target = cells to remove.
function digHoles(solution, target) {
  const puzzle = solution.slice();
  const order = shuffled([...Array(81).keys()]);
  let removed = 0;
  for (const i of order) {
    if (removed >= target) break;
    const backup = puzzle[i];
    puzzle[i] = 0;
    if (countSolutions(puzzle.slice(), 2) !== 1) puzzle[i] = backup;
    else removed++;
  }
  return puzzle;
}
const DIFF_TARGETS = { easy: 38, medium: 46, hard: 52, expert: 56 };

// ---- Game state ----
const DIFF_LABELS = { easy: "Easy", medium: "Medium", hard: "Hard", expert: "Expert" };
let puzzle = [], solution = [], player = [], pencil = [], given = [];
let selected = -1, pencilMode = false, showMistakes = true;
let difficulty = "easy", startTime = Date.now(), timerId = null, won = false;

document.addEventListener("DOMContentLoaded", async () => {
  buildBoard(); buildNumpad(); bindControls();
  const saved = await chrome.storage.local.get("sudoku");
  if (saved.sudoku && saved.sudoku.puzzle) {
    restore(saved.sudoku);
  } else {
    newGame("easy");
  }
  startTimer();
  render();
});

function newGame(diff) {
  difficulty = diff;
  solution = fullGrid();
  puzzle = digHoles(solution, DIFF_TARGETS[diff]);
  player = puzzle.slice();
  pencil = Array.from({ length: 81 }, () => []);
  given = puzzle.map(v => v !== 0);
  selected = -1; won = false;
  startTime = Date.now();
  document.getElementById("difficulty-label").textContent = DIFF_LABELS[diff];
  document.getElementById("difficulty").value = diff;
  persist();
}

function restore(s) {
  puzzle = s.puzzle; solution = s.solution; player = s.player;
  pencil = s.pencil; given = s.given; difficulty = s.difficulty || "easy";
  startTime = s.startTime || Date.now();
  document.getElementById("difficulty-label").textContent = DIFF_LABELS[difficulty];
  document.getElementById("difficulty").value = difficulty;
}
function persist() {
  chrome.storage.local.set({ sudoku: { puzzle, solution, player, pencil, given, difficulty, startTime } });
}

function buildBoard() {
  const board = document.getElementById("board");
  board.innerHTML = "";
  for (let i = 0; i < 81; i++) {
    const cell = document.createElement("button");
    cell.className = "cell";
    cell.dataset.idx = i;
    cell.setAttribute("role", "gridcell");
    cell.addEventListener("click", () => { selected = i; render(); });
    board.appendChild(cell);
  }
}
function buildNumpad() {
  const pad = document.getElementById("numpad");
  for (let n = 1; n <= 9; n++) {
    const k = document.createElement("button");
    k.className = "num-key"; k.textContent = n;
    k.addEventListener("click", () => enterNumber(n));
    pad.appendChild(k);
  }
}

function enterNumber(n) {
  if (selected < 0 || given[selected] || won) return;
  if (pencilMode) {
    const marks = pencil[selected];
    const at = marks.indexOf(n);
    if (at >= 0) marks.splice(at, 1); else { marks.push(n); marks.sort(); }
    player[selected] = 0;
  } else {
    player[selected] = (player[selected] === n) ? 0 : n;
    pencil[selected] = [];
  }
  persist(); render(); checkWin();
}

function eraseSelected() {
  if (selected < 0 || given[selected] || won) return;
  player[selected] = 0; pencil[selected] = [];
  persist(); render();
}

function hint() {
  if (won) return;
  const empties = [];
  for (let i = 0; i < 81; i++) if (!given[i] && player[i] !== solution[i]) empties.push(i);
  if (!empties.length) return;
  const i = empties[Math.floor(Math.random() * empties.length)];
  player[i] = solution[i]; pencil[i] = [];
  selected = i;
  persist(); render(); checkWin();
}

function mistakeAt(i) {
  return !given[i] && player[i] !== 0 && player[i] !== solution[i];
}

function checkWin() {
  if (won) return;
  for (let i = 0; i < 81; i++) if (player[i] !== solution[i]) return;
  won = true;
  clearInterval(timerId);
  render();
  const mins = Math.floor((Date.now() - startTime) / 60000);
  alert(`Solved in ${document.getElementById("timer").textContent} — ${DIFF_LABELS[difficulty]}. Nice!`);
}

function render() {
  const cells = document.getElementById("board").children;
  const selNum = selected >= 0 ? player[selected] : 0;
  for (let i = 0; i < 81; i++) {
    const cell = cells[i];
    cell.innerHTML = "";
    const v = player[i];
    cell.classList.toggle("given", !!given[i]);
    cell.classList.toggle("selected", i === selected);
    cell.classList.toggle("mistake", showMistakes && mistakeAt(i));
    if (v !== 0) {
      cell.textContent = v;
      cell.classList.toggle("same-num", selNum !== 0 && v === selNum && i !== selected);
      cell.classList.toggle("related", i !== selected && isRelated(i, selected));
    } else {
      cell.classList.remove("same-num", "related");
      if (pencil[i].length) {
        const wrap = document.createElement("span");
        wrap.className = "pencil";
        for (let n = 1; n <= 9; n++) {
          const s = document.createElement("span");
          s.textContent = pencil[i].includes(n) ? n : "";
          wrap.appendChild(s);
        }
        cell.appendChild(wrap);
      }
    }
  }
  updateTimer();
}
function isRelated(a, b) {
  if (b < 0) return false;
  return Math.floor(a / 9) === Math.floor(b / 9) ||
    a % 9 === b % 9 ||
    (Math.floor(a / 27) === Math.floor(b / 27) && Math.floor((a % 9) / 3) === Math.floor((b % 9) / 3));
}

function startTimer() {
  clearInterval(timerId);
  timerId = setInterval(updateTimer, 1000);
}
function updateTimer() {
  const s = Math.floor((Date.now() - startTime) / 1000);
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  document.getElementById("timer").textContent = `${mm}:${ss}`;
}

function bindControls() {
  document.getElementById("difficulty").addEventListener("change", e => newGame(e.target.value));
  document.getElementById("new-btn").addEventListener("click", () => newGame(document.getElementById("difficulty").value));
  document.getElementById("reset-btn").addEventListener("click", () => {
    player = puzzle.slice(); pencil = Array.from({ length: 81 }, () => []);
    won = false; startTime = Date.now(); startTimer(); persist(); render();
  });
  document.getElementById("erase-btn").addEventListener("click", eraseSelected);
  document.getElementById("hint-btn").addEventListener("click", hint);
  const pBtn = document.getElementById("pencil-btn");
  pBtn.addEventListener("click", () => { pencilMode = !pencilMode; pBtn.classList.toggle("active", pencilMode); });
  const mBtn = document.getElementById("mistakes-btn");
  mBtn.addEventListener("click", () => { showMistakes = !showMistakes; mBtn.classList.toggle("active", showMistakes); render(); });

  // Solver panel toggle
  const panel = document.getElementById("solver-panel");
  const tabBtn = document.getElementById("solve-tab-btn");
  tabBtn.addEventListener("click", () => { panel.classList.toggle("hidden"); tabBtn.classList.toggle("active"); });
  document.getElementById("solve-btn").addEventListener("click", runSolver);
  document.getElementById("clear-solver-btn").addEventListener("click", () => {
    document.getElementById("solver-input").value = "";
    document.getElementById("solver-output").textContent = "";
  });
  document.getElementById("load-btn").addEventListener("click", () => {
    const g = parsePuzzle(document.getElementById("solver-input").value);
    if (!g) { document.getElementById("solver-output").textContent = "Invalid puzzle — need 81 digits/0s/dots."; return; }
    const stats = { steps: 0 };
    const copy = g.slice();
    if (!solveGrid(copy, stats)) { document.getElementById("solver-output").textContent = "No solution exists for this puzzle."; return; }
    puzzle = g.slice(); solution = copy; player = g.slice();
    pencil = Array.from({ length: 81 }, () => []);
    given = g.map(v => v !== 0);
    selected = -1; won = false; startTime = Date.now(); startTimer();
    document.getElementById("difficulty-label").textContent = "Custom";
    persist(); render();
    document.getElementById("solver-output").textContent = `Loaded onto the board (${stats.steps} solver steps).`;
  });

  // Keyboard input
  document.addEventListener("keydown", e => {
    if (e.target.tagName === "TEXTAREA" || e.target.tagName === "INPUT") return;
    if (e.key >= "1" && e.key <= "9") enterNumber(parseInt(e.key, 10));
    else if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") eraseSelected();
    else if (e.key.toLowerCase() === "p") pBtn.click();
  });
}

// ---- Solver ----
function parsePuzzle(text) {
  const chars = text.replace(/[^0-9.]/g, "");
  if (chars.length !== 81) return null;
  return [...chars].map(c => (c === "." ? 0 : parseInt(c, 10)));
}
function runSolver() {
  const out = document.getElementById("solver-output");
  const g = parsePuzzle(document.getElementById("solver-input").value);
  if (!g) { out.textContent = "Invalid puzzle — need 81 digits/0s/dots."; return; }
  const stats = { steps: 0 };
  const t0 = performance.now();
  const solved = solveGrid(g, stats);
  const ms = (performance.now() - t0).toFixed(1);
  if (!solved) { out.textContent = "No solution exists for this puzzle."; return; }
  let pretty = "";
  for (let r = 0; r < 9; r++) {
    pretty += g.slice(r * 9, r * 9 + 9).join(" ") + (r % 3 === 2 && r < 8 ? "\n" : "") + "\n";
  }
  out.textContent = `Solved in ${stats.steps} steps (${ms} ms):\n${pretty}`;
}
