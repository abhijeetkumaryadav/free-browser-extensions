/* ===== Progressive Overload Logger — lift logbook (local only) =====
   Honest scope: personal logbook of YOUR sets. Not coaching advice. */

'use strict';

// ---------- Engine (pure logic, testable) ----------
// ENGINE-START
/**
 * Group sets by date for one exercise and compute session volumes.
 * @param {Array<{date:string,weight:number,reps:number}>} sets
 * @returns {Array<{date:string, volume:number, sets:number}>} sorted oldest→newest
 */
function sessionVolumes(sets) {
  const byDate = new Map();
  for (const s of sets) {
    const cur = byDate.get(s.date) || { date: s.date, volume: 0, sets: 0 };
    cur.volume += s.weight * s.reps;
    cur.sets += 1;
    byDate.set(s.date, cur);
  }
  return [...byDate.values()].sort((a, b) => a.date < b.date ? -1 : 1);
}

/**
 * Personal records for one exercise's sets.
 * @returns {{maxWeight:number|null, maxReps:number|null, bestSetVolume:number|null}}
 */
function personalRecords(sets) {
  if (!sets.length) return { maxWeight: null, maxReps: null, bestSetVolume: null };
  let maxWeight = 0, maxReps = 0, bestSetVolume = 0;
  for (const s of sets) {
    if (s.weight > maxWeight) maxWeight = s.weight;
    if (s.reps > maxReps) maxReps = s.reps;
    const v = s.weight * s.reps;
    if (v > bestSetVolume) bestSetVolume = v;
  }
  return { maxWeight, maxReps, bestSetVolume };
}

/** Convert weight between kg and lb. */
function convertWeight(value, fromUnit, toUnit) {
  if (fromUnit === toUnit) return value;
  return fromUnit === 'kg' ? value * 2.20462 : value / 2.20462;
}
// ENGINE-END

// ---------- UI ----------
const $ = (sel) => document.querySelector(sel);

let state = { sets: [], unit: 'kg' };

async function load() {
  const r = await chrome.storage.local.get(['sets', 'unit']);
  state.sets = r.sets || [];
  state.unit = r.unit || 'kg';
}

async function save() {
  await chrome.storage.local.set({ sets: state.sets, unit: state.unit });
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

/** Unique exercise names, alphabetical. */
function exerciseNames() {
  return [...new Set(state.sets.map(s => s.exercise))].sort((a, b) => a.localeCompare(b));
}

function fmtW(kg) {
  const v = convertWeight(kg, 'kg', state.unit);
  return (Math.round(v * 10) / 10) + state.unit;
}

function renderForm() {
  $('#unit-toggle').textContent = state.unit;
  const dl = $('#ex-list');
  dl.innerHTML = '';
  for (const name of exerciseNames()) {
    const opt = document.createElement('option');
    opt.value = name;
    dl.appendChild(opt);
  }
  if (!$('#ex-date').value) $('#ex-date').value = todayStr();
}

function renderPicker() {
  const names = exerciseNames();
  const picker = $('#ex-picker');
  const prev = picker.value;
  picker.innerHTML = '';
  if (!names.length) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = '— no exercises yet —';
    picker.appendChild(opt);
  } else {
    for (const n of names) {
      const opt = document.createElement('option');
      opt.value = n;
      opt.textContent = n;
      picker.appendChild(opt);
    }
  }
  picker.value = names.includes(prev) ? prev : names[0] || '';
}

function renderBadges() {
  const ex = $('#ex-picker').value;
  const box = $('#pr-badges');
  box.innerHTML = '';
  if (!ex) { box.innerHTML = '<span class="empty">Log sets to unlock PR badges.</span>'; return; }
  const sets = state.sets.filter(s => s.exercise === ex);
  const pr = personalRecords(sets);
  const items = [
    { label: 'Heaviest set', val: fmtW(pr.maxWeight) },
    { label: 'Most reps', val: pr.maxReps + ' reps' },
    { label: 'Best set volume', val: fmtW(pr.bestSetVolume) },
    { label: 'Total sets', val: String(sets.length) },
  ];
  for (const it of items) {
    const d = document.createElement('div');
    d.className = 'badge';
    d.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.5 13 17 22l-5-3-5 3 1.5-9"/></svg>' +
      '<span class="val"></span><span class="lbl"></span>';
    d.querySelector('.val').textContent = it.val;
    d.querySelector('.lbl').textContent = it.label;
    box.appendChild(d);
  }
}

/** Draw session-volume bars on the canvas. */
function renderChart() {
  const canvas = $('#volume-chart');
  const ctx = canvas.getContext('2d');
  const ex = $('#ex-picker').value;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const hint = $('#chart-hint');

  if (!ex) { hint.style.display = ''; return; }
  const sessions = sessionVolumes(state.sets.filter(s => s.exercise === ex)).slice(-14);
  if (!sessions.length) { hint.style.display = ''; return; }
  hint.style.display = 'none';

  const W = canvas.width, H = canvas.height, pad = 8;
  const max = Math.max(...sessions.map(s => s.volume), 1);
  const bw = (W - pad * 2) / sessions.length;
  sessions.forEach((s, i) => {
    const h = Math.max(3, (s.volume / max) * (H - pad * 2 - 14));
    const x = pad + i * bw + bw * 0.2;
    ctx.fillStyle = '#f43f5e';
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.roundRect(x, H - pad - 12 - h, bw * 0.6, h, 3);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#a1a1b3';
    ctx.font = '8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(s.date.slice(5), pad + i * bw + bw / 2, H - 2);
  });
}

function renderHistory() {
  const ex = $('#ex-picker').value;
  const box = $('#history');
  box.innerHTML = '';
  const sets = state.sets
    .filter(s => !ex || s.exercise === ex)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.ts - a.ts));
  if (!sets.length) { box.innerHTML = '<span class="empty">No sets logged yet.</span>'; return; }

  let lastEx = null;
  for (const s of sets) {
    if (s.exercise !== lastEx) {
      const h = document.createElement('div');
      h.className = 'group-head';
      h.textContent = s.exercise;
      box.appendChild(h);
      lastEx = s.exercise;
    }
    const row = document.createElement('div');
    row.className = 'set-row';
    const nums = document.createElement('span');
    nums.className = 'nums';
    nums.textContent = `${fmtW(s.weight)} × ${s.reps}`;
    const date = document.createElement('span');
    date.className = 'date';
    date.textContent = s.date;
    const del = document.createElement('button');
    del.className = 'del';
    del.textContent = '×';
    del.title = 'Delete set';
    del.addEventListener('click', async () => {
      state.sets = state.sets.filter(x => x.id !== s.id);
      await save();
      refresh();
    });
    row.append(nums, date, del);
    box.appendChild(row);
  }
}

function refresh() {
  renderForm();
  renderPicker();
  renderBadges();
  renderChart();
  renderHistory();
}

async function addSet() {
  const name = $('#ex-name').value.trim();
  const weight = parseFloat($('#ex-weight').value);
  const reps = parseInt($('#ex-reps').value, 10);
  const date = $('#ex-date').value || todayStr();
  if (!name || !(weight >= 0) || !(reps > 0)) {
    $('#ex-name').focus();
    return;
  }
  // Stored canonically in kg so the unit toggle stays consistent.
  const weightKg = convertWeight(weight, state.unit, 'kg');
  state.sets.push({ id: uid(), ts: Date.now(), exercise: name, weight: weightKg, reps, date });
  $('#ex-weight').value = '';
  $('#ex-reps').value = '';
  $('#ex-name').value = '';
  await save();
  refresh();
}

// ---------- Init ----------
document.addEventListener('DOMContentLoaded', async () => {
  await load();
  refresh();
  $('#add-set').addEventListener('click', addSet);
  $('#ex-picker').addEventListener('change', refresh);
  $('#unit-toggle').addEventListener('click', async () => {
    state.unit = state.unit === 'kg' ? 'lb' : 'kg';
    await save();
    refresh();
  });
  $('#ex-name').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addSet();
  });
});
