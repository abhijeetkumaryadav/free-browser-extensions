'use strict';

// ===== ENGINE-START =====
// Pure smoke-observation logic. No network, no DOM.
const SMOKE_LEVELS = [
  { v: 0, label: 'None',     color: '#34d399' },
  { v: 1, label: 'Faint',    color: '#a3e635' },
  { v: 2, label: 'Light',    color: '#facc15' },
  { v: 3, label: 'Moderate', color: '#fb923c' },
  { v: 4, label: 'Heavy',    color: '#f87171' },
  { v: 5, label: 'Severe',   color: '#991b1b' },
];

function smokeLevel(v) {
  if (!Number.isInteger(v) || v < 0 || v > 5) return null;
  return SMOKE_LEVELS[v];
}

function makeObservation(level, wind, note) {
  if (smokeLevel(level) === null) return null;
  return {
    level,
    wind: (wind || '').trim().slice(0, 40),
    note: (note || '').trim().slice(0, 140),
    ts: Date.now(),
  };
}

function sortObservations(obs) {
  return (obs || []).slice().sort((a, b) => b.ts - a.ts);
}

function avgLevelWindow(obs, days) {
  const cutoff = Date.now() - days * 864e5;
  const inWin = (obs || []).filter(o => o.ts >= cutoff);
  if (!inWin.length) return null;
  const avg = inWin.reduce((s, o) => s + o.level, 0) / inWin.length;
  return Math.round(avg * 10) / 10;
}

function fmtWhen(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
// ===== ENGINE-END =====

const $ = id => document.getElementById(id);
const STORAGE_KEY = 'smoke_obs';

// --- Tabs ---
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.pane').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    $('pane-' + btn.dataset.tab).classList.add('active');
  });
});

// --- Storage ---
async function loadObs() {
  const out = await chrome.storage.local.get(STORAGE_KEY);
  return Array.isArray(out[STORAGE_KEY]) ? out[STORAGE_KEY] : [];
}
async function saveObs(list) {
  await chrome.storage.local.set({ [STORAGE_KEY]: list });
}

// --- Render ---
async function refresh() {
  const list = sortObservations(await loadObs());
  const ul = $('history');
  ul.innerHTML = '';
  if (!list.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'No observations yet — log what you see and smell.';
    ul.appendChild(li);
  }
  for (const o of list) {
    const L = smokeLevel(o.level);
    const li = document.createElement('li');
    const lvl = document.createElement('span');
    lvl.className = 'lvl';
    lvl.style.color = L.color;
    lvl.textContent = o.level + '/5';
    li.appendChild(lvl);
    const meta = document.createElement('span');
    meta.className = 'meta';
    meta.textContent = L.label +
      (o.wind ? ' · ' + o.wind : '') +
      (o.note ? ' · ' + o.note : '') +
      ' · ' + fmtWhen(o.ts);
    li.appendChild(meta);
    const del = document.createElement('button');
    del.className = 'del';
    del.title = 'Delete';
    del.textContent = '×';
    del.addEventListener('click', async () => {
      await saveObs(list.filter(x => x.ts !== o.ts));
      refresh();
    });
    li.appendChild(del);
    ul.appendChild(li);
  }
  $('statCount').textContent = list.length;
  $('statLatest').textContent = list.length ? list[0].level + '/5' : '—';
  const avg = avgLevelWindow(list, 7);
  $('statAvg').textContent = avg === null ? '—' : avg;
}

// --- Add ---
$('addBtn').addEventListener('click', async () => {
  const o = makeObservation(
    parseInt($('levelSel').value, 10),
    $('windInput').value,
    $('noteInput').value
  );
  if (!o) return;
  const list = await loadObs();
  list.push(o);
  await saveObs(list);
  $('windInput').value = '';
  $('noteInput').value = '';
  refresh();
});

// --- Clear ---
$('clearBtn').addEventListener('click', async () => {
  if (confirm('Delete all observations?')) {
    await saveObs([]);
    refresh();
  }
});

refresh();
