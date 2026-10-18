/* Dotted — side panel bullet journal.
   Data model: { entries: [{id, date:'YYYY-MM-DD', type:'task'|'event'|'note',
   text, done}], future: [{id, date:'YYYY-MM-DD', text}] }
   All in chrome.storage.local. Dates are local-timezone. */
'use strict';

const uid = () => 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseYmd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };

let data = { entries: [], future: [] };
let viewDate = ymd(new Date());       // daily log date
let monthCursor = new Date();         // monthly view cursor (first of month)
let activeTab = 'daily';
let entryType = 'task';

async function load() {
  const s = await chrome.storage.local.get({ journal: null });
  if (s.journal && Array.isArray(s.journal.entries)) data = s.journal;
}
async function save() { await chrome.storage.local.set({ journal: data }); }

/* ---------- tabs ---------- */
document.querySelectorAll('.tab').forEach(t => {
  t.addEventListener('click', () => {
    activeTab = t.dataset.tab;
    document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('.pane').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    document.getElementById('pane-' + activeTab).classList.add('active');
    if (activeTab === 'monthly') renderMonthly();
  });
});

/* ---------- entry rows ---------- */
const BULLETS = { task: '•', event: '○', note: '—' };

function entryRow(e, showDate) {
  const li = document.createElement('li');
  const b = document.createElement('span');
  b.className = 'bullet ' + e.type;
  b.textContent = e.type === 'task' && e.done ? '×' : BULLETS[e.type];
  b.title = e.type === 'task' ? (e.done ? 'Mark incomplete' : 'Mark complete') : e.type;
  if (e.type === 'task') {
    b.addEventListener('click', async () => {
      e.done = !e.done; await save();
      if (activeTab === 'daily') renderDaily();
      else renderMonthlyList();
    });
  }
  const t = document.createElement('span');
  t.className = 'text' + (e.done ? ' done' : '');
  t.textContent = e.text;
  li.append(b, t);
  if (showDate) {
    const d = document.createElement('span');
    d.className = 'date-tag'; d.textContent = fmtShort(e.date);
    li.appendChild(d);
  }
  const del = document.createElement('button');
  del.className = 'del'; del.textContent = '✕'; del.title = 'Delete entry';
  del.addEventListener('click', async () => {
    data.entries = data.entries.filter(x => x.id !== e.id);
    await save(); renderAll();
  });
  li.appendChild(del);
  return li;
}

function fmtLong(dateStr) {
  return parseYmd(dateStr).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}
function fmtShort(dateStr) {
  return parseYmd(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/* ---------- daily log ---------- */
function renderDaily() {
  const d = parseYmd(viewDate);
  document.getElementById('dayLabel').textContent = fmtLong(viewDate);
  const n = data.entries.filter(e => e.date === viewDate).length;
  document.getElementById('daySub').textContent = `${n} entr${n === 1 ? 'y' : 'ies'}`;
  const ul = document.getElementById('entryList');
  ul.innerHTML = '';
  const list = data.entries.filter(e => e.date === viewDate)
    .sort((a, b) => (a.done - b.done) || a.id.localeCompare(b.id));
  if (!list.length) ul.innerHTML = '<li class="empty">Nothing logged yet — rapid log below.</li>';
  list.forEach(e => ul.appendChild(entryRow(e, false)));
}
document.getElementById('prevDay').addEventListener('click', () => shiftDay(-1));
document.getElementById('nextDay').addEventListener('click', () => shiftDay(1));
document.getElementById('todayBtn').addEventListener('click', () => { viewDate = ymd(new Date()); renderDaily(); });
function shiftDay(delta) {
  const d = parseYmd(viewDate); d.setDate(d.getDate() + delta);
  viewDate = ymd(d); renderDaily();
}

/* rapid-logging type buttons + prefix shortcuts */
document.querySelectorAll('.type-btn').forEach(b => {
  b.addEventListener('click', () => {
    entryType = b.dataset.type;
    document.querySelectorAll('.type-btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
  });
});
function detectPrefix(text) {
  const m = text.match(/^([.o\-–])\s+(.*)$/);
  if (!m) return null;
  return { type: m[1] === '.' ? 'task' : m[1] === 'o' ? 'event' : 'note', text: m[2] };
}
document.getElementById('entryForm').addEventListener('submit', async e => {
  e.preventDefault();
  const input = document.getElementById('entryInput');
  let text = input.value.trim();
  if (!text) return;
  let type = entryType;
  const p = detectPrefix(text);
  if (p) { type = p.type; text = p.text.trim(); if (!text) return; }
  data.entries.push({ id: uid(), date: viewDate, type, text, done: false });
  input.value = '';
  await save(); renderDaily();
});

/* ---------- monthly view ---------- */
const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
function renderMonthly() {
  const y = monthCursor.getFullYear(), m = monthCursor.getMonth();
  document.getElementById('monthLabel').textContent =
    monthCursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const grid = document.getElementById('monthGrid');
  grid.innerHTML = '';
  DOW.forEach(d => { const s = document.createElement('div'); s.className = 'dow'; s.textContent = d; grid.appendChild(s); });
  const first = new Date(y, m, 1).getDay();
  const days = new Date(y, m + 1, 0).getDate();
  const counts = {};
  data.entries.forEach(e => { counts[e.date] = (counts[e.date] || 0) + 1; });
  for (let i = 0; i < first; i++) { const b = document.createElement('div'); b.className = 'day blank'; grid.appendChild(b); }
  for (let day = 1; day <= days; day++) {
    const ds = `${y}-${pad(m + 1)}-${pad(day)}`;
    const cell = document.createElement('button');
    cell.className = 'day' + (ds === ymd(new Date()) ? ' today' : '') + (counts[ds] ? ' has-entries' : '');
    cell.textContent = day;
    cell.title = counts[ds] ? `${counts[ds]} entries` : 'No entries';
    cell.addEventListener('click', () => {
      viewDate = ds;
      document.querySelector('.tab[data-tab="daily"]').click();
    });
    grid.appendChild(cell);
  }
  renderMonthlyList();
}
function renderMonthlyList() {
  const y = monthCursor.getFullYear(), m = monthCursor.getMonth();
  const ul = document.getElementById('monthList');
  ul.innerHTML = '';
  const list = data.entries
    .filter(e => { const d = parseYmd(e.date); return d.getFullYear() === y && d.getMonth() === m; })
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!list.length) { ul.innerHTML = '<li class="empty">No entries this month.</li>'; return; }
  let last = '';
  for (const e of list) {
    if (e.date !== last) {
      last = e.date;
      const h = document.createElement('div');
      h.className = 'group-head'; h.textContent = fmtLong(e.date);
      ul.appendChild(h);
    }
    ul.appendChild(entryRow(e, false));
  }
}
document.getElementById('prevMonth').addEventListener('click', () => { monthCursor.setMonth(monthCursor.getMonth() - 1); renderMonthly(); });
document.getElementById('nextMonth').addEventListener('click', () => { monthCursor.setMonth(monthCursor.getMonth() + 1); renderMonthly(); });

/* ---------- future log ---------- */
function renderFuture() {
  const ul = document.getElementById('futureList');
  ul.innerHTML = '';
  const list = [...data.future].sort((a, b) => a.date.localeCompare(b.date));
  if (!list.length) { ul.innerHTML = '<li class="empty">No future entries — plan ahead above.</li>'; return; }
  for (const f of list) {
    const li = document.createElement('li');
    const d = document.createElement('span');
    d.className = 'date-tag'; d.textContent = fmtLong(f.date);
    const t = document.createElement('span');
    t.className = 'text'; t.textContent = f.text;
    const del = document.createElement('button');
    del.className = 'del'; del.textContent = '✕'; del.title = 'Delete entry';
    del.addEventListener('click', async () => {
      data.future = data.future.filter(x => x.id !== f.id);
      await save(); renderFuture();
    });
    li.append(d, t, del);
    ul.appendChild(li);
  }
}
document.getElementById('futureForm').addEventListener('submit', async e => {
  e.preventDefault();
  const text = document.getElementById('futureText').value.trim();
  const date = document.getElementById('futureDate').value;
  if (!text || !date) return;
  data.future.push({ id: uid(), date, text });
  e.target.reset();
  await save(); renderFuture();
});

/* ---------- search ---------- */
document.getElementById('search').addEventListener('input', e => {
  const q = e.target.value.trim().toLowerCase();
  document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
  document.querySelectorAll('.pane').forEach(x => x.classList.remove('active'));
  if (!q) {
    document.querySelector(`.tab[data-tab="${activeTab}"]`).classList.add('active');
    document.getElementById('pane-' + activeTab).classList.add('active');
    return;
  }
  document.getElementById('pane-search').classList.add('active');
  const ul = document.getElementById('searchList');
  ul.innerHTML = '';
  const hits = data.entries.filter(en => en.text.toLowerCase().includes(q))
    .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 100);
  if (!hits.length) { ul.innerHTML = '<li class="empty">No matches.</li>'; return; }
  let last = '';
  for (const en of hits) {
    if (en.date !== last) {
      last = en.date;
      const h = document.createElement('div');
      h.className = 'group-head'; h.textContent = fmtLong(en.date);
      ul.appendChild(h);
    }
    ul.appendChild(entryRow(en, false));
  }
});

function renderAll() { renderDaily(); renderMonthly(); renderFuture(); }
(async () => { await load(); renderAll(); })();
