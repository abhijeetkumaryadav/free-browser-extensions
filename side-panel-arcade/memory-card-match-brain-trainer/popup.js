// ============================================================================
// MemoMatch — memory card match brain trainer.
// 3 difficulties (4x4 / 6x6 / 8x8), Lucide-style stroke SVG card faces,
// moves + timer + per-difficulty best scores in chrome.storage.local.
// No network, no analytics.
// ============================================================================
"use strict";

const STORE_KEY = "memomatch_best";
const FLIP_BACK_MS = 750;

const DIFFS = {
  easy:   { cols: 4, pairs: 8 },
  medium: { cols: 6, pairs: 18 },
  hard:   { cols: 8, pairs: 32 },
};

// ---------- Card faces: Lucide-style stroke SVGs (24x24) ----------
// Hand-drawn icon paths (stroke, round caps) …
const HAND_ICONS = [
  ["M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"],
  ["M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"],
  ["M13 2 3 14h9l-1 8 10-12h-9l1-8z"],
  ["M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"],
  ["M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z", "M12 2v2", "M12 20v2", "M4.9 4.9l1.4 1.4", "M17.7 17.7l1.4 1.4", "M2 12h2", "M20 12h2", "M4.9 19.1l1.4-1.4", "M17.7 6.3l1.4-1.4"],
  ["M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"],
  ["M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9", "M10.3 21a1.94 1.94 0 0 0 3.4 0"],
  ["M9 18V5l12-2v13", "M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z", "M18 19a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"],
  ["M3 8h18", "M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7", "M12 8v13", "M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5"],
  ["M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z", "M4 22v-7"],
  ["M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z", "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"],
  ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M8 14s1.5 2 4 2 4-2 4-2", "M9 9h.01", "M15 9h.01"],
  ["M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z", "M12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"],
  ["M12 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z", "M12 8v13", "M5 12H2a10 10 0 0 0 20 0h-3"],
  ["M12 15a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z", "m15.5 8.5 5 5", "m17 13 2 2", "m19.5 10.5 2 2"],
  ["M12 2a9 9 0 0 1 9 9H3a9 9 0 0 1 9-9Z", "M12 2v18", "M12 22a2.5 2.5 0 0 0 5 0"],
];

// …plus crisp geometric shapes (also stroke-based).
function polyPoints(n, r, cx, cy, rot) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2;
    pts.push((cx + r * Math.cos(a)).toFixed(2) + "," + (cy + r * Math.sin(a)).toFixed(2));
  }
  return pts.join(" ");
}
function starPath(cx, cy, rO, rI, n) {
  let d = "";
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? rO : rI;
    const a = -Math.PI / 2 + (i / (n * 2)) * Math.PI * 2;
    d += (i === 0 ? "M" : "L") + (cx + r * Math.cos(a)).toFixed(2) + " " + (cy + r * Math.sin(a)).toFixed(2);
  }
  return d + "Z";
}
const SHAPE_SVGS = [
  '<circle cx="12" cy="12" r="7"/>',
  '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',
  '<rect x="5" y="5" width="14" height="14" rx="1.5"/>',
  '<path d="M12 4 20 19H4Z"/>',
  '<path d="M12 3 21 12 12 21 3 12Z"/>',
  `<polygon points="${polyPoints(5, 8.5, 12, 12.5, -Math.PI / 2)}"/>`,
  `<polygon points="${polyPoints(6, 8.5, 12, 12, 0)}"/>`,
  `<path d="${starPath(12, 12, 9, 3.8, 5)}"/>`,
  '<path d="M12 4v16M4 12h16"/>',
  '<path d="M6 6l12 12M18 6L6 18"/>',
  '<path d="M4 9h16M4 15h16"/>',
  '<circle cx="6" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="18" cy="12" r="1.8"/>',
  '<path d="M6 9l6 6 6-6"/>',
  '<path d="M4 12h16M13 5l7 7-7 7"/>',
  '<path d="M3 12c2-4.5 4-4.5 6 0s4 4.5 6 0 4-4.5 6 0"/>',
  '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="1.5"/>',
];

function iconSvg(paths) {
  const inner = paths.map((p) => `<path d="${p}"/>`).join("");
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}
function shapeSvg(inner) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}
// 32 unique faces: 16 icons + 16 shapes.
const FACES = [
  ...HAND_ICONS.map(iconSvg),
  ...SHAPE_SVGS.map(shapeSvg),
];

// ---------- DOM ----------
const menuEl = document.getElementById("menu");
const gameEl = document.getElementById("game");
const boardEl = document.getElementById("board");
const movesEl = document.getElementById("moves");
const pairsEl = document.getElementById("pairs");
const timeEl = document.getElementById("time");
const winEl = document.getElementById("win");
const winSub = document.getElementById("winSub");
const winBest = document.getElementById("winBest");

// ---------- State ----------
let diffKey = "easy";
let deck = [];          // face indices, shuffled, 2x each
let first = null;       // first flipped card element
let lock = false;
let moves = 0;
let matchedPairs = 0;
let totalPairs = 0;
let startTime = 0;
let timerId = null;
let elapsed = 0;

function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

async function getBest() {
  const data = await chrome.storage.local.get(STORE_KEY);
  return data[STORE_KEY] || {};
}

async function renderMenu() {
  const best = await getBest();
  for (const key of Object.keys(DIFFS)) {
    const el = document.getElementById("best-" + key);
    const b = best[key];
    el.textContent = b ? `best ${b.moves} moves · ${fmtTime(b.time)}` : "no best yet";
  }
  menuEl.classList.remove("hidden");
  gameEl.classList.add("hidden");
  winEl.classList.add("hidden");
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function startGame(key) {
  diffKey = key;
  const { cols, pairs } = DIFFS[key];
  totalPairs = pairs;
  // Pick `pairs` unique faces and duplicate.
  const faces = shuffle([...FACES.keys()]).slice(0, pairs);
  deck = shuffle([...faces, ...faces]);
  moves = 0;
  matchedPairs = 0;
  elapsed = 0;
  first = null;
  lock = false;
  stopTimer();

  boardEl.dataset.cols = cols;
  boardEl.innerHTML = "";
  deck.forEach((faceIdx) => {
    const card = document.createElement("div");
    card.className = "card";
    card.dataset.face = faceIdx;
    card.innerHTML =
      `<div class="card-inner">` +
      `<div class="face back"></div>` +
      `<div class="face front">${FACES[faceIdx]}</div>` +
      `</div>`;
    card.addEventListener("click", () => flip(card));
    boardEl.appendChild(card);
  });

  movesEl.textContent = "0";
  pairsEl.textContent = `0/${pairs}`;
  timeEl.textContent = "0:00";
  winBest.classList.add("hidden");

  menuEl.classList.add("hidden");
  gameEl.classList.remove("hidden");
  winEl.classList.add("hidden");
}

function startTimer() {
  startTime = Date.now();
  timerId = setInterval(() => {
    elapsed = (Date.now() - startTime) / 1000;
    timeEl.textContent = fmtTime(elapsed);
  }, 500);
}
function stopTimer() {
  if (timerId) clearInterval(timerId);
  timerId = null;
}

function flip(card) {
  if (lock || card.classList.contains("flipped") || card.classList.contains("matched")) return;
  if (!timerId && moves === 0 && matchedPairs === 0 && !first) startTimer();
  card.classList.add("flipped");
  if (!first) {
    first = card;
    return;
  }
  // Second card: count a move.
  moves++;
  movesEl.textContent = moves;
  const a = first, b = card;
  first = null;
  if (a.dataset.face === b.dataset.face) {
    a.classList.add("matched");
    b.classList.add("matched");
    matchedPairs++;
    pairsEl.textContent = `${matchedPairs}/${totalPairs}`;
    if (matchedPairs === totalPairs) win();
  } else {
    lock = true;
    setTimeout(() => {
      a.classList.remove("flipped");
      b.classList.remove("flipped");
      lock = false;
    }, FLIP_BACK_MS);
  }
}

async function win() {
  stopTimer();
  const secs = Math.round(elapsed);
  const best = await getBest();
  const prev = best[diffKey];
  const isRecord = !prev || moves < prev.moves || (moves === prev.moves && secs < prev.time);
  if (isRecord) {
    best[diffKey] = { moves, time: secs };
    await chrome.storage.local.set({ [STORE_KEY]: best });
  }
  winSub.textContent = `${DIFFS[diffKey].cols}×${DIFFS[diffKey].cols} cleared in ${moves} moves · ${fmtTime(secs)}`;
  winBest.classList.toggle("hidden", !isRecord);
  setTimeout(() => winEl.classList.remove("hidden"), 450);
}

// ---------- Wiring ----------
document.querySelectorAll(".diff").forEach((btn) => {
  btn.addEventListener("click", () => startGame(btn.dataset.diff));
});
document.getElementById("restart").addEventListener("click", () => startGame(diffKey));
document.getElementById("quit").addEventListener("click", renderMenu);
document.getElementById("again").addEventListener("click", () => startGame(diffKey));
document.getElementById("change").addEventListener("click", renderMenu);

renderMenu();
