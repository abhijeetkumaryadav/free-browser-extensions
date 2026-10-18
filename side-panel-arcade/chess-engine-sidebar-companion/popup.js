/* PawnStorm — from-scratch chess engine (minimax + alpha-beta, piece-square
 * tables) plus popup UI. No network, no external engine. Casual strength. */
'use strict';

/* ================= Engine ================= */
const VAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
const GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };

// Simple piece-square tables (from White's perspective, row 0 = rank 8).
const PST = {
  p: [0,0,0,0,0,0,0,0, 50,50,50,50,50,50,50,50, 10,10,20,30,30,20,10,10,
      5,5,10,25,25,10,5,5, 0,0,0,20,20,0,0,0, 5,-5,-10,0,0,-10,-5,5, 0,0,0,0,0,0,0,0],
  n: [-50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,0,0,0,-20,-40, -30,0,10,15,15,10,0,-30,
      -30,5,15,20,20,15,5,-30, -30,0,15,20,20,15,0,-30, -30,5,10,15,15,10,5,-30, -40,-20,0,5,5,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50],
  b: [-20,-10,-10,-10,-10,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,10,10,5,0,-10,
      -10,5,5,10,10,5,5,-10, -10,0,10,10,10,10,0,-10, -10,10,10,10,10,10,10,-10, -10,5,0,0,0,0,5,-10, -20,-10,-10,-10,-10,-10,-10,-20],
  r: [0,0,0,0,0,0,0,0, 5,10,10,10,10,10,10,5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5,
      -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, 0,0,0,5,5,0,0,0],
  q: [-20,-10,-10,-5,-5,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,5,5,5,0,-10,
      -5,0,5,5,5,5,0,-5, 0,0,5,5,5,5,0,-5, -10,5,5,5,5,5,0,-10, -10,0,5,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20],
  k: [-30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30,
      -30,-40,-40,-50,-50,-40,-40,-30, -20,-30,-30,-40,-40,-30,-30,-20, -10,-20,-20,-20,-20,-20,-20,-10, 20,20,0,0,0,0,20,20, 20,30,10,0,0,10,30,20]
};
const pstScore = (t, r, c, color) => color === 'w' ? PST[t][r * 8 + c] : PST[t][(7 - r) * 8 + c];

function newGame() {
  const back = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
  const b = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (let c = 0; c < 8; c++) {
    b[0][c] = { t: back[c], c: 'b' }; b[1][c] = { t: 'p', c: 'b' };
    b[6][c] = { t: 'p', c: 'w' }; b[7][c] = { t: back[c], c: 'w' };
  }
  return {
    board: b, turn: 'w',
    castle: { wK: true, wQ: true, bK: true, bQ: true },
    ep: null, half: 0, history: []
  };
}
const opp = c => c === 'w' ? 'b' : 'w';
const inB = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;

function findKing(g, color) {
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = g.board[r][c];
    if (p && p.t === 'k' && p.c === color) return [r, c];
  }
  return null;
}
function attacked(g, r, c, by) {
  const B = g.board;
  // Pawns
  const pr = by === 'w' ? r + 1 : r - 1;
  for (const dc of [-1, 1]) {
    if (inB(pr, c + dc)) { const p = B[pr][c + dc]; if (p && p.t === 'p' && p.c === by) return true; }
  }
  // Knights
  for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
    if (inB(r + dr, c + dc)) { const p = B[r + dr][c + dc]; if (p && p.t === 'n' && p.c === by) return true; }
  }
  // King
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    if (!dr && !dc) continue;
    if (inB(r + dr, c + dc)) { const p = B[r + dr][c + dc]; if (p && p.t === 'k' && p.c === by) return true; }
  }
  // Sliders
  const rays = [[[-1,0],[1,0],[0,-1],[0,1],['r','q']], [[-1,-1],[-1,1],[1,-1],[1,1],['b','q']]];
  for (const grp of rays) {
    const kinds = grp[4];
    for (let i = 0; i < 4; i++) {
      let rr = r + grp[i][0], cc = c + grp[i][1];
      while (inB(rr, cc)) {
        const p = B[rr][cc];
        if (p) { if (p.c === by && kinds.includes(p.t)) return true; break; }
        rr += grp[i][0]; cc += grp[i][1];
      }
    }
  }
  return false;
}
const inCheck = (g, color) => { const k = findKing(g, color); return k ? attacked(g, k[0], k[1], opp(color)) : false; };

/* Move: {fr,fc,tr,tc,promo,castle:'K'|'Q'|null,ep:bool} */
function pseudoMoves(g, r, c) {
  const B = g.board, p = B[r][c];
  if (!p) return [];
  const moves = [];
  const add = (tr, tc, extra = {}) => { if (inB(tr, tc)) moves.push(Object.assign({ fr: r, fc: c, tr, tc }, extra)); };
  const dir = p.c === 'w' ? -1 : 1;
  if (p.t === 'p') {
    if (!B[r + dir][c]) {
      add(r + dir, c, (r + dir === 0 || r + dir === 7) ? { promo: 'q' } : {});
      const start = p.c === 'w' ? 6 : 1;
      if (r === start && !B[r + 2 * dir][c]) add(r + 2 * dir, c);
    }
    for (const dc of [-1, 1]) {
      const tr = r + dir, tc = c + dc;
      if (!inB(tr, tc)) continue;
      const t = B[tr][tc];
      if (t && t.c !== p.c) add(tr, tc, (tr === 0 || tr === 7) ? { promo: 'q' } : {});
      else if (!t && g.ep && g.ep[0] === tr && g.ep[1] === tc) add(tr, tc, { ep: true });
    }
  } else if (p.t === 'n') {
    for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
      const tr = r + dr, tc = c + dc;
      if (inB(tr, tc) && (!B[tr][tc] || B[tr][tc].c !== p.c)) add(tr, tc);
    }
  } else if (p.t === 'k') {
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const tr = r + dr, tc = c + dc;
      if (inB(tr, tc) && (!B[tr][tc] || B[tr][tc].c !== p.c)) add(tr, tc);
    }
    // Castling
    const home = p.c === 'w' ? 7 : 0;
    if (r === home && c === 4 && !inCheck(g, p.c)) {
      const K = p.c === 'w' ? 'wK' : 'bK', Q = p.c === 'w' ? 'wQ' : 'bQ';
      if (g.castle[K] && !B[home][5] && !B[home][6] &&
          !attacked(g, home, 5, opp(p.c)) && !attacked(g, home, 6, opp(p.c)))
        add(home, 6, { castle: 'K' });
      if (g.castle[Q] && !B[home][1] && !B[home][2] && !B[home][3] &&
          !attacked(g, home, 3, opp(p.c)) && !attacked(g, home, 2, opp(p.c)))
        add(home, 2, { castle: 'Q' });
    }
  } else {
    const dirs = p.t === 'r' ? [[-1,0],[1,0],[0,-1],[0,1]]
      : p.t === 'b' ? [[-1,-1],[-1,1],[1,-1],[1,1]]
      : [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]];
    for (const [dr, dc] of dirs) {
      let tr = r + dr, tc = c + dc;
      while (inB(tr, tc)) {
        const t = B[tr][tc];
        if (!t) add(tr, tc);
        else { if (t.c !== p.c) add(tr, tc); break; }
        tr += dr; tc += dc;
      }
    }
  }
  return moves;
}

function applyMove(g, m) {
  const B = g.board, p = B[m.fr][m.fc];
  g.history.push({
    move: Object.assign({}, m), captured: B[m.tr][m.tc] ? Object.assign({}, B[m.tr][m.tc]) : null,
    epCaptured: null, castle: JSON.parse(JSON.stringify(g.castle)), ep: g.ep, half: g.half,
    prevPiece: Object.assign({}, p)
  });
  const h = g.history[g.history.length - 1];
  if (m.ep) { h.epCaptured = Object.assign({}, B[m.fr][m.tc]); B[m.fr][m.tc] = null; }
  if (m.castle) {
    const home = p.c === 'w' ? 7 : 0;
    if (m.castle === 'K') { B[home][5] = B[home][7]; B[home][7] = null; }
    else { B[home][3] = B[home][0]; B[home][0] = null; }
  }
  B[m.tr][m.tc] = m.promo ? { t: m.promo, c: p.c } : p;
  B[m.fr][m.fc] = null;
  // Castling rights
  if (p.t === 'k') { g.castle[p.c + 'K'] = false; g.castle[p.c + 'Q'] = false; }
  if (p.t === 'r') {
    const home = p.c === 'w' ? 7 : 0;
    if (m.fr === home && m.fc === 0) g.castle[p.c + 'Q'] = false;
    if (m.fr === home && m.fc === 7) g.castle[p.c + 'K'] = false;
  }
  const tc = B[m.tr][m.tc];
  if (tc && tc.t === 'r' && (m.tr === 0 || m.tr === 7)) {
    const oc = opp(p.c), home = oc === 'w' ? 7 : 0;
    if (m.tr === home && m.tc === 0) g.castle[oc + 'Q'] = false;
    if (m.tr === home && m.tc === 7) g.castle[oc + 'K'] = false;
  }
  g.ep = (p.t === 'p' && Math.abs(m.tr - m.fr) === 2) ? [(m.tr + m.fr) / 2, m.fc] : null;
  g.half = (p.t === 'p' || h.captured || h.epCaptured) ? 0 : g.half + 1;
  g.turn = opp(g.turn);
}
function undoMove(g) {
  const h = g.history.pop();
  if (!h) return false;
  const m = h.move, B = g.board;
  g.turn = opp(g.turn);
  B[m.fr][m.fc] = h.prevPiece;
  B[m.tr][m.tc] = null;
  if (h.captured) B[m.tr][m.tc] = h.captured;
  if (h.epCaptured) B[m.fr][m.tc] = h.epCaptured;
  if (m.castle) {
    const home = h.prevPiece.c === 'w' ? 7 : 0;
    if (m.castle === 'K') { B[home][7] = B[home][5]; B[home][5] = null; }
    else { B[home][0] = B[home][3]; B[home][3] = null; }
  }
  g.castle = h.castle; g.ep = h.ep; g.half = h.half;
  return true;
}

function legalMoves(g, color) {
  const out = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = g.board[r][c];
    if (p && p.c === color) {
      for (const m of pseudoMoves(g, r, c)) {
        applyMove(g, m);
        if (!inCheck(g, color)) out.push(m);
        undoMove(g);
      }
    }
  }
  return out;
}

function evaluate(g) {
  let s = 0;
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = g.board[r][c];
    if (p) {
      const v = VAL[p.t] + pstScore(p.t, r, c, p.c);
      s += p.c === 'w' ? v : -v;
    }
  }
  return s; // centipawns, + favors White
}

const TIMEOUT = 1e15; // sentinel: search aborted by time budget
let nodeCount = 0;

function orderMoves(g, moves) {
  // Captures first (MVV-ish): cheap but effective ordering for alpha-beta.
  moves.sort((a, b) => {
    const va = g.board[a.tr][a.tc] ? VAL[g.board[a.tr][a.tc].t] : 0;
    const vb = g.board[b.tr][b.tc] ? VAL[g.board[b.tr][b.tc].t] : 0;
    return vb - va;
  });
}

function search(g, depth, alpha, beta, deadline) {
  if ((++nodeCount & 1023) === 0 && Date.now() > deadline) return TIMEOUT;
  const moves = legalMoves(g, g.turn);
  if (moves.length === 0) {
    if (inCheck(g, g.turn)) return g.turn === 'w' ? -100000 - depth : 100000 + depth;
    return 0;
  }
  if (depth === 0) return evaluate(g);
  orderMoves(g, moves);
  if (g.turn === 'w') {
    let best = -Infinity;
    for (const m of moves) {
      applyMove(g, m);
      const s = search(g, depth - 1, alpha, beta, deadline);
      undoMove(g);
      if (s === TIMEOUT) return TIMEOUT;
      if (s > best) best = s;
      if (best > alpha) alpha = best;
      if (beta <= alpha) break;
    }
    return best;
  }
  let best = Infinity;
  for (const m of moves) {
    applyMove(g, m);
    const s = search(g, depth - 1, alpha, beta, deadline);
    undoMove(g);
    if (s === TIMEOUT) return TIMEOUT;
    if (s < best) best = s;
    if (best < beta) beta = best;
    if (beta <= alpha) break;
  }
  return best;
}

/* Iterative deepening with a time budget so the popup never hangs.
 * Always returns a move (falls back to the deepest completed depth). */
function engineMove(g, maxDepth, budgetMs) {
  const moves = legalMoves(g, g.turn);
  if (!moves.length) return null;
  orderMoves(g, moves);
  nodeCount = 0;
  const deadline = Date.now() + budgetMs;
  let best = moves[Math.floor(Math.random() * moves.length)];
  let bestScore = evaluate(g);
  for (let depth = 1; depth <= maxDepth; depth++) {
    let cur = null, curScore = g.turn === 'w' ? -Infinity : Infinity;
    let aborted = false;
    for (const m of moves) {
      applyMove(g, m);
      const s = search(g, depth - 1, -Infinity, Infinity, deadline);
      undoMove(g);
      if (s === TIMEOUT) { aborted = true; break; }
      const better = g.turn === 'w' ? s > curScore : s < curScore;
      if (cur === null || better || (s === curScore && Math.random() < 0.25)) {
        cur = m; curScore = s;
      }
      if (Date.now() > deadline) { aborted = true; break; }
    }
    if (aborted) break;
    best = cur; bestScore = curScore;
  }
  return { move: best, score: bestScore };
}

// Difficulty presets: [maxDepth, timeBudgetMs]
const DIFF_PRESETS = { 1: [1, 400], 2: [2, 1500], 3: [4, 4000] };

/* ================= UI ================= */
const $ = id => document.getElementById(id);
const svg = inner => `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
const FILES = 'abcdefgh';

let G = newGame();
let flipped = false, selected = null, selMoves = [], lastMove = null, gameOver = false;
let difficulty = 2, evalCp = 0;

const sqName = (r, c) => FILES[c] + (8 - r);
function moveToSan(g, m) {
  // Compute SAN-ish notation BEFORE applying (needs disambiguation-lite).
  const B = g.board, p = B[m.fr][m.fc];
  if (m.castle) return m.castle === 'K' ? 'O-O' : 'O-O-O';
  const dest = sqName(m.tr, m.tc);
  const isCap = B[m.tr][m.tc] || m.ep;
  if (p.t === 'p') return (isCap ? FILES[m.fc] + 'x' : '') + dest + (m.promo ? '=Q' : '');
  return p.t.toUpperCase() + (isCap ? 'x' : '') + dest;
}

function renderBoard() {
  const board = $('board');
  board.innerHTML = '';
  const legal = legalMoves(G, 'w');
  for (let dr = 0; dr < 8; dr++) for (let dc = 0; dc < 8; dc++) {
    const r = flipped ? 7 - dr : dr, c = flipped ? 7 - dc : dc;
    const sq = document.createElement('div');
    sq.className = 'sq ' + ((r + c) % 2 === 0 ? 'light' : 'dark');
    sq.setAttribute('role', 'gridcell');
    const p = G.board[r][c];
    if (p) {
      const sp = document.createElement('span');
      sp.className = p.c === 'w' ? 'piece-w' : 'piece-b';
      sp.textContent = GLYPH[p.t];
      sq.appendChild(sp);
    }
    if (selected && selected[0] === r && selected[1] === c) sq.classList.add('sel');
    if (lastMove && ((lastMove.fr === r && lastMove.fc === c) || (lastMove.tr === r && lastMove.tc === c)))
      sq.classList.add('last');
    if (selected) {
      const mv = selMoves.find(m => m.tr === r && m.tc === c);
      if (mv) {
        const mark = document.createElement('span');
        mark.className = G.board[r][c] || mv.ep ? 'ring' : 'dot';
        sq.appendChild(mark);
      }
    }
    sq.addEventListener('click', () => onSquare(r, c, legal));
    board.appendChild(sq);
  }
}

function renderMoves() {
  const list = $('moveList');
  const hist = G.history;
  if (!hist.length) { list.innerHTML = '<span class="empty">No moves yet — you play White.</span>'; return; }
  list.innerHTML = '';
  for (let i = 0; i < hist.length; i += 2) {
    const n = document.createElement('span');
    n.className = 'move-num';
    n.textContent = (i / 2 + 1) + '.';
    list.appendChild(n);
    const w = document.createElement('span'); w.textContent = hist[i].san + ' '; list.appendChild(w);
    if (hist[i + 1]) { const b = document.createElement('b'); b.textContent = hist[i + 1].san + ' '; list.appendChild(b); }
  }
  list.scrollTop = list.scrollHeight;
}

function setStatus(text, thinking = false) {
  $('statusText').textContent = text;
  $('statusDot').classList.toggle('thinking', thinking);
  $('thinking').hidden = !thinking;
}
function renderEval() {
  // Eval from White's (player's) perspective
  const v = evalCp / 100;
  $('evalText').textContent = (v >= 0 ? '+' : '') + v.toFixed(1);
}

function updateGameState() {
  const moves = legalMoves(G, G.turn);
  renderEval();
  if (moves.length === 0) {
    gameOver = true;
    setStatus(inCheck(G, G.turn) ? (G.turn === 'w' ? 'Checkmate — engine wins' : 'Checkmate — you win!') : 'Stalemate — draw');
  } else if (G.half >= 100) {
    gameOver = true;
    setStatus('Draw — 50-move rule');
  } else {
    gameOver = false;
    setStatus(G.turn === 'w'
      ? (inCheck(G, 'w') ? 'Your move — check!' : 'Your move')
      : 'Engine thinking…', G.turn === 'b');
  }
  $('undoBtn').disabled = gameOver || G.history.length === 0;
  renderBoard(); renderMoves();
}

function onSquare(r, c, legal) {
  if (gameOver || G.turn !== 'w') return;
  const p = G.board[r][c];
  if (selected) {
    const mv = selMoves.find(m => m.tr === r && m.tc === c);
    if (mv) { playerMove(mv); return; }
  }
  if (p && p.c === 'w') {
    selected = [r, c];
    selMoves = legal.filter(m => m.fr === r && m.fc === c);
  } else {
    selected = null; selMoves = [];
  }
  renderBoard();
}

function playerMove(mv) {
  const san = moveToSan(G, mv);
  applyMove(G, mv);
  G.history[G.history.length - 1].san = san + (inCheck(G, 'b') && legalMoves(G, 'b').length === 0 ? '#' : inCheck(G, 'b') ? '+' : '');
  selected = null; selMoves = []; lastMove = mv;
  evalCp = evaluate(G);
  persist();
  updateGameState();
  if (!gameOver) setTimeout(engineTurn, 350);
}

function engineTurn() {
  if (gameOver || G.turn !== 'b') return;
  setStatus('Engine thinking…', true);
  setTimeout(() => {
    const [maxDepth, budget] = DIFF_PRESETS[difficulty] || DIFF_PRESETS[2];
    const res = engineMove(G, maxDepth, budget);
    if (!res) { updateGameState(); return; }
    const san = moveToSan(G, res.move);
    applyMove(G, res.move);
    G.history[G.history.length - 1].san = san + (inCheck(G, 'w') && legalMoves(G, 'w').length === 0 ? '#' : inCheck(G, 'w') ? '+' : '');
    lastMove = res.move;
    evalCp = res.score;
    persist();
    updateGameState();
  }, 30);
}

/* ---------- Persistence (position only; engine recomputes) ---------- */
const SAVE_KEY = 'pawnstorm_save_v1';
async function persist() {
  try {
    await chrome.storage.local.set({ [SAVE_KEY]: {
      board: G.board, turn: G.turn, castle: G.castle, ep: G.ep, half: G.half,
      history: G.history, difficulty, flipped
    }});
  } catch (e) { /* storage unavailable — play session-only */ }
}
async function restore() {
  try {
    const d = await chrome.storage.local.get(SAVE_KEY);
    const s = d[SAVE_KEY];
    if (!s || !s.board) return false;
    G = newGame();
    G.board = s.board; G.turn = s.turn; G.castle = s.castle; G.ep = s.ep; G.half = s.half || 0;
    G.history = Array.isArray(s.history) ? s.history : [];
    difficulty = s.difficulty || 2; flipped = !!s.flipped;
    evalCp = evaluate(G);
    return true;
  } catch (e) { return false; }
}

/* ---------- Wiring ---------- */
function setIcons() {
  $('brandMark').textContent = '♞';
  const icons = {
    new: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>',
    undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/>',
    flip: '<path d="M7 16V4m0 0L3 8m4-4 4 4"/><path d="M17 8v12m0 0 4-4m-4 4-4-4"/>'
  };
  document.querySelectorAll('.ctl-ico').forEach(el => {
    el.innerHTML = svg(icons[el.dataset.ico]);
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  setIcons();
  const had = await restore();
  $('diffSelect').value = String(difficulty);
  updateGameState();
  // If it's the engine's turn after restore (shouldn't normally happen), let it move.
  if (had && G.turn === 'b' && !gameOver) setTimeout(engineTurn, 500);

  $('diffSelect').addEventListener('change', e => {
    difficulty = parseInt(e.target.value, 10);
    persist();
  });
  $('newBtn').addEventListener('click', () => {
    if (G.history.length && !confirm('Start a new game? Current position will be lost.')) return;
    G = newGame(); selected = null; selMoves = []; lastMove = null; evalCp = 0;
    persist(); updateGameState();
  });
  $('undoBtn').addEventListener('click', () => {
    if (gameOver || G.turn !== 'w' || !G.history.length) return;
    undoMove(G); // take back the engine's reply
    if (G.history.length) undoMove(G); // take back the player's move
    selected = null; selMoves = [];
    const h = G.history[G.history.length - 1];
    lastMove = h && h.move ? h.move : null;
    evalCp = evaluate(G);
    persist(); updateGameState();
  });
  $('flipBtn').addEventListener('click', () => {
    flipped = !flipped; persist(); renderBoard();
  });
});
