'use strict';
/* WordBox — Wordle-style game. Bundled word lists (words.js), stats in chrome.storage.local. No network. */

const ROWS = 6, COLS = 5;

const boardEl = document.getElementById('board');
const kbEl = document.getElementById('keyboard');
const toastEl = document.getElementById('toast');
const tabDaily = document.getElementById('tab-daily');
const tabPractice = document.getElementById('tab-practice');

/* ---------- State ---------- */
let mode = 'daily';          // 'daily' | 'practice'
let answer = '';
let guesses = [];            // submitted guesses (strings)
let evaluations = [];       // parallel array of ['correct','present','absent'...]
let current = '';            // in-progress row input
let status = 'playing';      // 'playing' | 'won' | 'lost'
let stats = null;
let dailyKey = '';           // YYYY-MM-DD for daily mode
let toastTimer = null;

/* ---------- Storage keys ---------- */
const K_STATS = 'wordboxStats';
const K_DAILY_PREFIX = 'wordboxDaily:';   // + date
const K_PRACTICE = 'wordboxPractice';

/* ---------- Helpers ---------- */
function todayKey() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// Deterministic daily word from the date (FNV-1a hash → answer index).
function dailyWord(dateKey) {
  let h = 0x811c9dc5;
  for (let i = 0; i < dateKey.length; i++) {
    h ^= dateKey.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return WORDLE_ANSWERS[h % WORDLE_ANSWERS.length];
}

function defaultStats() {
  return { played: 0, wins: 0, streak: 0, maxStreak: 0, dist: [0, 0, 0, 0, 0, 0] };
}

/* ---------- Toast ---------- */
function toast(msg, ms = 1400) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms);
}

/* ---------- Board & keyboard rendering ---------- */
function buildBoard() {
  boardEl.innerHTML = '';
  for (let r = 0; r < ROWS; r++) {
    const row = document.createElement('div');
    row.className = 'row';
    for (let c = 0; c < COLS; c++) {
      const tile = document.createElement('div');
      tile.className = 'tile';
      row.appendChild(tile);
    }
    boardEl.appendChild(row);
  }
}

const KB_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
function buildKeyboard() {
  kbEl.innerHTML = '';
  KB_ROWS.forEach((letters, i) => {
    const row = document.createElement('div');
    row.className = 'key-row';
    if (i === 2) row.appendChild(makeKey('Enter', 'wide'));
    for (const ch of letters) row.appendChild(makeKey(ch, ''));
    if (i === 2) row.appendChild(makeKey('⌫', 'wide'));
    kbEl.appendChild(row);
  });
}

function makeKey(label, extra) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'key ' + extra;
  b.textContent = label;
  b.dataset.key = label.toLowerCase() === '⌫' ? 'backspace' : label.toLowerCase();
  b.addEventListener('click', () => handleKey(b.dataset.key));
  return b;
}

function paintTile(r, c, letter, state, delay) {
  const tile = boardEl.children[r].children[c];
  setTimeout(() => {
    tile.textContent = letter;
    tile.classList.add('filled', 'reveal', state);
  }, delay);
}

function paintKey(letter, state) {
  const btn = kbEl.querySelector(`[data-key="${letter}"]`);
  if (!btn) return;
  // Priority: correct > present > absent. Never downgrade.
  const rank = { absent: 0, present: 1, correct: 2 };
  const cur = ['correct', 'present', 'absent'].find((s) => btn.classList.contains(s));
  if (!cur || rank[state] > rank[cur]) {
    btn.classList.remove('correct', 'present', 'absent');
    btn.classList.add(state);
  }
}

function refreshRow() {
  const row = boardEl.children[guesses.length];
  for (let c = 0; c < COLS; c++) {
    const tile = row.children[c];
    const ch = current[c] || '';
    tile.textContent = ch;
    tile.classList.toggle('filled', !!ch);
  }
}

function restoreBoard() {
  buildBoard(); buildKeyboard();
  guesses.forEach((g, r) => {
    g.split('').forEach((ch, c) => {
      const tile = boardEl.children[r].children[c];
      tile.textContent = ch;
      tile.classList.add(evaluations[r][c]);
    });
    g.split('').forEach((ch, c) => paintKey(ch, evaluations[r][c]));
  });
  refreshRow();
}

/* ---------- Game logic ---------- */
// Two-pass evaluation with correct duplicate-letter handling.
function evaluate(guess, ans) {
  const res = Array(COLS).fill('absent');
  const remaining = {};
  for (let i = 0; i < COLS; i++) {
    if (guess[i] === ans[i]) res[i] = 'correct';
    else remaining[ans[i]] = (remaining[ans[i]] || 0) + 1;
  }
  for (let i = 0; i < COLS; i++) {
    if (res[i] !== 'correct' && remaining[guess[i]] > 0) {
      res[i] = 'present';
      remaining[guess[i]]--;
    }
  }
  return res;
}

function handleKey(key) {
  if (status !== 'playing') return;
  if (key === 'enter') { submitGuess(); return; }
  if (key === 'backspace') { current = current.slice(0, -1); refreshRow(); return; }
  if (/^[a-z]$/.test(key) && current.length < COLS) {
    current += key;
    refreshRow();
  }
}

function submitGuess() {
  if (current.length < COLS) { shakeRow(); toast('Not enough letters'); return; }
  if (!WORDLE_ALLOWED.has(current)) { shakeRow(); toast('Not in word list'); return; }

  const r = guesses.length;
  const ev = evaluate(current, answer);
  guesses.push(current);
  evaluations.push(ev);

  ev.forEach((st, c) => paintTile(r, c, current[c], st, c * 120));
  current.split('').forEach((ch, c) => setTimeout(() => paintKey(ch, ev[c]), c * 120 + 250));
  current = '';
  setTimeout(() => afterGuess(r), COLS * 120 + 260);
}

function afterGuess(r) {
  refreshRow();
  if (guesses[r] === answer) {
    status = 'won';
    boardEl.children[r].classList.add('win');
    toast(['Genius!', 'Magnificent!', 'Impressive!', 'Splendid!', 'Great!', 'Phew!'][r]);
    finishGame(true);
  } else if (guesses.length === ROWS) {
    status = 'lost';
    toast('The word was ' + answer.toUpperCase(), 3000);
    finishGame(false);
  } else {
    persist();
  }
}

function shakeRow() {
  const row = boardEl.children[guesses.length];
  row.classList.remove('shake');
  void row.offsetWidth; // restart animation
  row.classList.add('shake');
}

function finishGame(won) {
  stats.played++;
  if (won) {
    stats.wins++;
    stats.streak++;
    stats.maxStreak = Math.max(stats.maxStreak, stats.streak);
    stats.dist[guesses.length - 1]++;
  } else {
    stats.streak = 0;
  }
  persist();
  setTimeout(showStats, 900);
}

/* ---------- Persistence ---------- */
function persist() {
  const game = { answer, guesses, evaluations, status };
  const data = { [K_STATS]: stats };
  data[mode === 'daily' ? K_DAILY_PREFIX + dailyKey : K_PRACTICE] = game;
  chrome.storage.local.set(data);
}

function newGame(forMode, forcedAnswer) {
  mode = forMode;
  answer = forcedAnswer || WORDLE_ANSWERS[Math.floor(Math.random() * WORDLE_ANSWERS.length)];
  guesses = []; evaluations = []; current = ''; status = 'playing';
  restoreBoard();
  updateTabs();
  persist();
}

function loadGame() {
  dailyKey = todayKey();
  chrome.storage.local.get(
    { [K_STATS]: defaultStats(), [K_DAILY_PREFIX + dailyKey]: null, [K_PRACTICE]: null },
    (res) => {
      stats = Object.assign(defaultStats(), res[K_STATS]);
      const saved = mode === 'daily' ? res[K_DAILY_PREFIX + dailyKey] : res[K_PRACTICE];
      if (saved && saved.answer) {
        // Resume saved game (same date's daily word is deterministic, so it matches).
        answer = saved.answer; guesses = saved.guesses; evaluations = saved.evaluations; status = saved.status;
        restoreBoard();
      } else {
        answer = mode === 'daily' ? dailyWord(dailyKey) : WORDLE_ANSWERS[Math.floor(Math.random() * WORDLE_ANSWERS.length)];
        restoreBoard();
      }
      updateTabs();
      if (status !== 'playing') setTimeout(showStats, 600);
    }
  );
}

function updateTabs() {
  tabDaily.classList.toggle('active', mode === 'daily');
  tabPractice.classList.toggle('active', mode === 'practice');
  tabDaily.setAttribute('aria-selected', mode === 'daily');
  tabPractice.setAttribute('aria-selected', mode === 'practice');
}

/* ---------- Stats & help modals ---------- */
function showStats() {
  document.getElementById('st-played').textContent = stats.played;
  document.getElementById('st-winpct').textContent = stats.played ? Math.round((stats.wins / stats.played) * 100) : 0;
  document.getElementById('st-streak').textContent = stats.streak;
  document.getElementById('st-max').textContent = stats.maxStreak;
  const dist = document.getElementById('dist');
  dist.innerHTML = '';
  const max = Math.max(1, ...stats.dist);
  stats.dist.forEach((n, i) => {
    const row = document.createElement('div');
    row.className = 'dist-row';
    const num = document.createElement('span');
    num.className = 'dist-num'; num.textContent = i + 1;
    const bar = document.createElement('div');
    bar.className = 'dist-bar' + (status !== 'playing' && guesses.length - 1 === i ? ' hot' : '');
    bar.style.width = Math.max(10, Math.round((n / max) * 100)) + '%';
    bar.textContent = n;
    row.append(num, bar);
    dist.appendChild(row);
  });
  document.getElementById('stats-modal').classList.remove('hidden');
}

/* ---------- Events ---------- */
document.addEventListener('keydown', (e) => {
  if (!document.getElementById('stats-modal').classList.contains('hidden') ||
      !document.getElementById('help-modal').classList.contains('hidden')) {
    if (e.key === 'Escape') {
      document.getElementById('stats-modal').classList.add('hidden');
      document.getElementById('help-modal').classList.add('hidden');
    }
    return;
  }
  if (e.key === 'Enter') handleKey('enter');
  else if (e.key === 'Backspace') handleKey('backspace');
  else if (/^[a-zA-Z]$/.test(e.key)) handleKey(e.key.toLowerCase());
});

tabDaily.addEventListener('click', () => { mode = 'daily'; loadGame(); });
tabPractice.addEventListener('click', () => { mode = 'practice'; loadGame(); });

document.getElementById('new-practice-btn').addEventListener('click', () => {
  mode = 'practice';
  newGame('practice');
  toast('New practice word');
});
document.getElementById('stats-btn').addEventListener('click', showStats);
document.getElementById('stats-close').addEventListener('click', () =>
  document.getElementById('stats-modal').classList.add('hidden'));
document.getElementById('help-btn').addEventListener('click', () =>
  document.getElementById('help-modal').classList.remove('hidden'));
document.getElementById('help-close').addEventListener('click', () =>
  document.getElementById('help-modal').classList.add('hidden'));

/* ---------- Init ---------- */
loadGame();
