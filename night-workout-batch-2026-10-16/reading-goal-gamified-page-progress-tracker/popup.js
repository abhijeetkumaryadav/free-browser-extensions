'use strict';
/* Reading Goals — gamified reading progress tracker.
 * All data is self-reported by the user and stored locally.
 * No network, no accounts, no external services. */

// ================= ENGINE-START =================
const DAY_MS = 86400000;

/** Clamp a goal value to a sane range. */
function clampGoal(v) {
  v = parseInt(v, 10);
  if (!Number.isFinite(v)) return 1;
  return Math.max(1, Math.min(100000, v));
}

/** Build a session record. Returns null when invalid. */
function makeSession(title, pages, when) {
  title = String(title || '').trim().slice(0, 120);
  pages = parseInt(pages, 10);
  if (!title || !Number.isFinite(pages) || pages < 1 || pages > 5000) return null;
  when = Number.isFinite(+when) ? +when : Date.now();
  return { id: 's' + when + Math.floor(Math.random() * 1e6), title, pages, when };
}

/** Aggregate stats from sessions: total pages, distinct books, day streak. */
function computeStats(sessions, now) {
  now = Number.isFinite(+now) ? +now : Date.now();
  const pages = sessions.reduce((a, s) => a + (s.pages || 0), 0);
  const books = new Set(sessions.map(s => s.title.toLowerCase())).size;
  // Streak: consecutive UTC days (ending today or yesterday) with >=1 session.
  const days = new Set(sessions.map(s => Math.floor(s.when / DAY_MS)));
  const today = Math.floor(now / DAY_MS);
  let streak = 0;
  let d = days.has(today) ? today : today - 1;
  while (days.has(d)) { streak++; d--; }
  return { pages, books, streak };
}

/** Goal progress: value depends on goal type ('pages' | 'books'). */
function goalProgress(stats, goal) {
  if (!goal || !goal.value) return 0;
  const have = goal.type === 'books' ? stats.books : stats.pages;
  return Math.min(1, have / goal.value);
}

/** Percent string + ring offset for a 0..1 progress (r=42 → C≈263.9). */
function ringFor(progress) {
  const p = Math.max(0, Math.min(1, progress));
  return { pct: Math.round(p * 100), offset: 263.9 * (1 - p) };
}
// ================= ENGINE-END =================

const $ = id => document.getElementById(id);
const store = {
  async load() {
    const d = await chrome.storage.local.get(['rg-goal', 'rg-sessions', 'rg-note']);
    return {
      goal: d['rg-goal'] || { type: 'pages', value: 5000 },
      sessions: Array.isArray(d['rg-sessions']) ? d['rg-sessions'] : [],
      note: d['rg-note'] || ''
    };
  },
  async save(s) {
    await chrome.storage.local.set({ 'rg-goal': s.goal, 'rg-sessions': s.sessions, 'rg-note': s.note });
  }
};

let data = null;

function fmtDate(when) {
  return new Date(when).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function render() {
  const stats = computeStats(data.sessions);
  const prog = goalProgress(stats, data.goal);
  const ring = ringFor(prog);
  $('ringFill').style.strokeDashoffset = ring.offset;
  $('goalPct').textContent = ring.pct + '%';
  $('statPages').textContent = stats.pages.toLocaleString();
  $('statBooks').textContent = stats.books;
  $('statStreak').textContent = stats.streak;
  $('goalType').value = data.goal.type;
  $('goalValue').value = data.goal.value;
  $('note').value = data.note;

  const list = $('sessions');
  list.innerHTML = '';
  const sorted = [...data.sessions].sort((a, b) => b.when - a.when).slice(0, 30);
  if (!sorted.length) list.innerHTML = '<div class="session"><span class="t" style="color:#8a8a99">No sessions yet — log your first one above.</span></div>';
  for (const s of sorted) {
    const row = document.createElement('div');
    row.className = 'session';
    const t = document.createElement('span'); t.className = 't'; t.textContent = s.title;
    const p = document.createElement('span'); p.className = 'p'; p.textContent = s.pages + ' pg';
    const d = document.createElement('span'); d.className = 'd'; d.textContent = fmtDate(s.when);
    const del = document.createElement('button'); del.textContent = '✕'; del.title = 'Delete';
    del.addEventListener('click', async () => {
      data.sessions = data.sessions.filter(x => x.id !== s.id);
      await store.save(data); render();
    });
    row.append(t, p, d, del);
    list.appendChild(row);
  }
}

$('add').addEventListener('click', async () => {
  const s = makeSession($('book').value, $('pages').value, Date.now());
  if (!s) return;
  data.sessions.push(s);
  if (data.sessions.length > 1000) data.sessions = data.sessions.slice(-1000);
  $('book').value = ''; $('pages').value = '';
  await store.save(data); render();
});

$('saveGoal').addEventListener('click', async () => {
  data.goal = { type: $('goalType').value === 'books' ? 'books' : 'pages', value: clampGoal($('goalValue').value) };
  await store.save(data); render();
});

let noteTimer = null;
$('note').addEventListener('input', () => {
  clearTimeout(noteTimer);
  noteTimer = setTimeout(async () => { data.note = $('note').value; await store.save(data); }, 500);
});

(async () => { data = await store.load(); render(); })();
