/* Medication Schedule Tracker — popup UI. CRUD for user-entered medications,
   today's check-off list, streak/total stats. Never suggests doses. */
'use strict';

const $ = id => document.getElementById(id);
const todayKey = () => new Date().toISOString().slice(0, 10);

function msg(type, data = {}) {
  return new Promise(resolve => chrome.runtime.sendMessage({ type, ...data }, resolve));
}

function iconTrash() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`;
}
function iconCheck() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>`;
}

async function refresh() {
  const res = await msg('getState');
  if (!res.ok) return;
  const state = res.state;
  renderToday(state);
  renderStats(state);
  wireFreq();
}

function renderToday(state) {
  const list = $('today-list');
  const today = todayKey();
  const taken = state.taken[today] || [];
  if (!state.meds.length) {
    list.innerHTML = `<div class="empty">No medications yet — add one above.</div>`;
    return;
  }
  list.innerHTML = '';
  for (const med of state.meds) {
    for (const t of med.times) {
      const key = `${med.id}@${t}`;
      const done = taken.includes(key);
      const row = document.createElement('div');
      row.className = 'med';
      row.innerHTML = `
        <button class="check ${done ? 'done' : ''}" data-key="${key}" title="Mark taken">${done ? iconCheck() : ''}</button>
        <div class="info"><div class="name">${escapeHtml(med.name)}</div>
        <div class="times">${t}${med.dose ? ' · ' + escapeHtml(med.dose) : ''}</div></div>`;
      row.querySelector('.check').addEventListener('click', async () => {
        await msg('toggleTaken', { key });
        refresh();
      });
      list.appendChild(row);
    }
  }
  // per-med delete row
  const delWrap = document.createElement('div');
  state.meds.forEach(med => {
    const b = document.createElement('button');
    b.className = 'icon-btn';
    b.title = `Remove ${med.name}`;
    b.innerHTML = iconTrash();
    b.addEventListener('click', async () => {
      if (confirm(`Remove "${med.name}" and all its reminders?`)) {
        await msg('deleteMed', { id: med.id });
        refresh();
      }
    });
    delWrap.appendChild(b);
  });
  if (delWrap.children.length) {
    const label = document.createElement('div');
    label.style.cssText = 'font-size:11px;color:var(--muted);margin-top:8px;display:flex;align-items:center;gap:6px;';
    label.textContent = 'Remove medication: ';
    label.appendChild(delWrap);
    list.appendChild(label);
  }
}

function renderStats(state) {
  const today = todayKey();
  $('stat-taken').textContent = (state.taken[today] || []).length;
  $('stat-streak').textContent = state.stats.streak || 0;
  $('stat-total').textContent = state.stats.total || 0;
}

// Auto-fill the times box with evenly spaced suggestions when frequency changes
function wireFreq() {
  const freq = $('med-freq');
  const times = $('med-times');
  if (freq.dataset.wired) return;
  freq.dataset.wired = '1';
  freq.addEventListener('change', () => {
    const n = parseInt(freq.value, 10);
    const base = ['08:00', '14:00', '20:00', '23:00'];
    const start = ['08:00', '08:00', '08:00', '08:00'][n - 1];
    times.value = n === 1 ? '08:00'
      : n === 2 ? '08:00, 20:00'
      : n === 3 ? '08:00, 14:00, 20:00'
      : '08:00, 12:00, 18:00, 22:00';
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

$('add-btn').addEventListener('click', async () => {
  const name = $('med-name').value.trim();
  const dose = $('med-dose').value.trim();
  const times = $('med-times').value.trim();
  const freq = parseInt($('med-freq').value, 10);
  if (!name) { alert('Enter a medication name.'); return; }
  const res = await msg('addMed', { name, dose, times, freq });
  if (!res.ok) { alert(res.error); return; }
  $('med-name').value = '';
  $('med-dose').value = '';
  $('med-times').value = '';
  refresh();
});

refresh();
