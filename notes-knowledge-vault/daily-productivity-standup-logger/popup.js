/* StandLog — daily standup journal. All data in chrome.storage.local. */
'use strict';

/* ---------- Date helpers ---------- */
const pad = (n) => String(n).padStart(2, '0');
// Local YYYY-MM-DD key (no timezone shift issues)
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayKey = () => dayKey(new Date());
const prettyDate = (d) => d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
const prettyKey = (key) => {
  const [y, m, dd] = key.split('-').map(Number);
  return new Date(y, m - 1, dd).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
};

/* ---------- Storage ---------- */
const store = {
  async get() {
    const { entries = {} } = await chrome.storage.local.get('entries');
    return entries;
  },
  async set(entries) {
    await chrome.storage.local.set({ entries });
  },
  hasContent(e) {
    return e && (e.yesterday.trim() || e.today.trim() || e.blockers.trim());
  }
};

/* ---------- State ---------- */
let entries = {};
let calCursor = new Date(); calCursor.setDate(1); // first of viewed month
let detailKey = null;

const $ = (id) => document.getElementById(id);

/* ---------- Tabs ---------- */
document.querySelectorAll('.tab').forEach((t) => {
  t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'));
    document.querySelectorAll('.tabpanel').forEach((x) => x.classList.remove('active'));
    t.classList.add('active');
    $(`tab-${t.dataset.tab}`).classList.add('active');
    if (t.dataset.tab === 'calendar') renderCalendar();
    if (t.dataset.tab === 'entries') renderList($('searchInput').value);
  });
});

/* ---------- Today tab ---------- */
async function loadToday() {
  const e = entries[todayKey()] || { yesterday: '', today: '', blockers: '' };
  $('fYesterday').value = e.yesterday || '';
  $('fToday').value = e.today || '';
  $('fBlockers').value = e.blockers || '';
}

$('saveBtn').addEventListener('click', async () => {
  const entry = {
    yesterday: $('fYesterday').value,
    today: $('fToday').value,
    blockers: $('fBlockers').value,
    updatedAt: Date.now()
  };
  if (!store.hasContent(entry)) {
    $('saveStatus').textContent = 'Write something first — empty entries are not saved.';
    $('saveStatus').style.color = '#f87171';
    return;
  }
  entries[todayKey()] = entry;
  await store.set(entries);
  updateStreak();
  $('saveStatus').textContent = `Saved ✓ — ${prettyKey(todayKey())}`;
  $('saveStatus').style.color = '#34d399';
  setTimeout(() => { $('saveStatus').textContent = ''; }, 2500);
});

function download(filename, text) {
  const blob = new Blob([text], { type: 'text/markdown' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

$('exportBtn').addEventListener('click', () => {
  const keys = Object.keys(entries).sort();
  if (!keys.length) {
    $('saveStatus').textContent = 'No entries to export yet.';
    $('saveStatus').style.color = '#f87171';
    return;
  }
  let md = '# StandLog Export\n\n';
  for (const k of keys) {
    const e = entries[k];
    md += `## ${prettyKey(k)}\n\n`;
    if (e.yesterday.trim()) md += `**Yesterday**\n${e.yesterday.trim()}\n\n`;
    if (e.today.trim()) md += `**Today**\n${e.today.trim()}\n\n`;
    if (e.blockers.trim()) md += `**Blockers**\n${e.blockers.trim()}\n\n`;
    md += '---\n\n';
  }
  download(`standlog-export-${todayKey()}.md`, md);
});

/* ---------- Streak ---------- */
// Consecutive calendar days (ending today or yesterday) with an entry.
function updateStreak() {
  let streak = 0;
  const d = new Date();
  if (!store.hasContent(entries[dayKey(d)])) d.setDate(d.getDate() - 1); // allow today-in-progress
  while (store.hasContent(entries[dayKey(d)])) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  $('streakCount').textContent = streak;
}

/* ---------- Calendar ---------- */
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DOWS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

function renderCalendar() {
  const y = calCursor.getFullYear(), m = calCursor.getMonth();
  $('calTitle').textContent = `${MONTHS[m]} ${y}`;
  const grid = $('calGrid');
  grid.innerHTML = '';
  DOWS.forEach((d) => {
    const el = document.createElement('div');
    el.className = 'dow'; el.textContent = d;
    grid.appendChild(el);
  });
  const firstDow = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const tk = todayKey();
  for (let i = 0; i < firstDow; i++) {
    const el = document.createElement('div');
    el.className = 'day empty';
    grid.appendChild(el);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const key = `${y}-${pad(m + 1)}-${pad(day)}`;
    const btn = document.createElement('button');
    btn.className = 'day';
    if (key === tk) btn.classList.add('today');
    btn.innerHTML = `<span>${day}</span>${store.hasContent(entries[key]) ? '<span class="has-dot"></span>' : ''}`;
    btn.addEventListener('click', () => openDetail(key));
    grid.appendChild(btn);
  }
}

$('calPrev').addEventListener('click', () => { calCursor.setMonth(calCursor.getMonth() - 1); renderCalendar(); });
$('calNext').addEventListener('click', () => { calCursor.setMonth(calCursor.getMonth() + 1); renderCalendar(); });

/* ---------- Detail modal ---------- */
function openDetail(key) {
  detailKey = key;
  const e = entries[key] || { yesterday: '', today: '', blockers: '' };
  $('detailDate').textContent = prettyKey(key);
  $('dYesterday').value = e.yesterday || '';
  $('dToday').value = e.today || '';
  $('dBlockers').value = e.blockers || '';
  $('detailModal').classList.remove('hidden');
}
function closeDetail() { $('detailModal').classList.add('hidden'); detailKey = null; }

$('detailClose').addEventListener('click', closeDetail);
$('detailModal').addEventListener('click', (ev) => { if (ev.target === $('detailModal')) closeDetail(); });

$('detailSave').addEventListener('click', async () => {
  const entry = {
    yesterday: $('dYesterday').value,
    today: $('dToday').value,
    blockers: $('dBlockers').value,
    updatedAt: Date.now()
  };
  if (store.hasContent(entry)) entries[detailKey] = entry;
  else delete entries[detailKey];
  await store.set(entries);
  updateStreak();
  closeDetail();
  renderCalendar();
  if (detailKey === null) loadToday(); // modal closed; refresh today view state
  renderList($('searchInput').value);
});

$('detailDelete').addEventListener('click', async () => {
  if (!detailKey || !entries[detailKey]) { closeDetail(); return; }
  if (confirm(`Delete the entry for ${prettyKey(detailKey)}?`)) {
    delete entries[detailKey];
    await store.set(entries);
    updateStreak();
    closeDetail();
    renderCalendar();
    loadToday();
    renderList($('searchInput').value);
  }
});

/* ---------- Entries list + search ---------- */
function excerpt(e) {
  return [e.yesterday, e.today, e.blockers].filter((s) => s && s.trim()).join(' ').trim();
}

function renderList(query = '') {
  const q = query.trim().toLowerCase();
  const list = $('entryList');
  list.innerHTML = '';
  const keys = Object.keys(entries)
    .filter((k) => store.hasContent(entries[k]))
    .filter((k) => {
      if (!q) return true;
      const e = entries[k];
      return (e.yesterday + ' ' + e.today + ' ' + e.blockers + ' ' + prettyKey(k)).toLowerCase().includes(q);
    })
    .sort()
    .reverse();
  if (!keys.length) {
    list.innerHTML = `<p class="empty-msg">${q ? 'No entries match your search.' : 'No entries yet — write your first standup in the Today tab.'}</p>`;
    return;
  }
  for (const k of keys) {
    const card = document.createElement('div');
    card.className = 'entry-card';
    const h = document.createElement('h4');
    h.textContent = prettyKey(k);
    const p = document.createElement('p');
    p.textContent = excerpt(entries[k]);
    card.append(h, p);
    card.addEventListener('click', () => openDetail(k));
    list.appendChild(card);
  }
}

$('searchInput').addEventListener('input', (ev) => renderList(ev.target.value));

/* ---------- Init ---------- */
(async function init() {
  entries = await store.get();
  $('dateLabel').textContent = prettyDate(new Date());
  await loadToday();
  updateStreak();
  renderCalendar();
})();
