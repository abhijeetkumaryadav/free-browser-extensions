/* WatchSync — Anime Watchlist Tracker
   Manual tracker: series live in chrome.storage.local. No account APIs,
   no scraping — everything the user enters stays on this device. */

'use strict';

const STORE_KEY = 'watchsync_series_v1';
const STATUSES = ['Watching', 'Completed', 'On Hold', 'Dropped', 'Plan to Watch'];

// --- DOM refs ---------------------------------------------------------------
const listEl = document.getElementById('list');
const emptyEl = document.getElementById('empty');
const statsEl = document.getElementById('stats');
const searchEl = document.getElementById('search');
const filterEl = document.getElementById('filter-status');
const addForm = document.getElementById('add-form');
const addTitleEl = document.getElementById('add-title');
const addTotalEl = document.getElementById('add-total');
const exportBtn = document.getElementById('export-btn');
const importBtn = document.getElementById('import-btn');
const importFileEl = document.getElementById('import-file');
const modal = document.getElementById('modal');
const editTitleEl = document.getElementById('edit-title');
const editTotalEl = document.getElementById('edit-total');
const editStatusEl = document.getElementById('edit-status');
const editSaveBtn = document.getElementById('edit-save');
const editCancelBtn = document.getElementById('edit-cancel');
const editDeleteBtn = document.getElementById('edit-delete');

let series = [];        // full list from storage
let editingId = null;   // series id currently in the edit modal

// --- Storage ----------------------------------------------------------------
async function loadSeries() {
  const data = await chrome.storage.local.get(STORE_KEY);
  series = Array.isArray(data[STORE_KEY]) ? data[STORE_KEY] : [];
}

async function saveSeries() {
  await chrome.storage.local.set({ [STORE_KEY]: series });
}

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// --- Helpers ----------------------------------------------------------------
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function badgeClass(status) {
  return 'badge ' + status.replace(/\s+/g, '-');
}

function clampWatched(s) {
  s.watched = Math.max(0, Math.min(s.total > 0 ? s.total : s.watched, s.watched));
  return s;
}

// --- Rendering ---------------------------------------------------------------
function visibleSeries() {
  const q = searchEl.value.trim().toLowerCase();
  const f = filterEl.value;
  return series
    .filter(s => (f === 'all' || s.status === f))
    .filter(s => !q || s.title.toLowerCase().includes(q))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

function renderStats() {
  const watching = series.filter(s => s.status === 'Watching').length;
  const completed = series.filter(s => s.status === 'Completed').length;
  const totalEps = series.reduce((n, s) => n + (s.watched || 0), 0);
  statsEl.innerHTML =
    `<div class="stat"><strong>${series.length}</strong>Series</div>` +
    `<div class="stat"><strong>${watching}</strong>Watching</div>` +
    `<div class="stat"><strong>${completed}</strong>Completed</div>` +
    `<div class="stat"><strong>${totalEps}</strong>Eps watched</div>`;
}

function starRow(s) {
  let html = '';
  for (let i = 1; i <= 5; i++) {
    html += `<button class="star${i <= (s.rating || 0) ? ' on' : ''}" data-action="rate" data-id="${s.id}" data-value="${i}" aria-label="Rate ${i} of 5">` +
      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></button>`;
  }
  return `<div class="stars">${html}</div>`;
}

function cardHTML(s) {
  const pct = s.total > 0 ? Math.round((s.watched / s.total) * 100) : 0;
  const totalLabel = s.total > 0 ? ` / ${s.total}` : '';
  return `
    <div class="card" data-id="${s.id}">
      <div class="card-top">
        <span class="card-title" title="${esc(s.title)}">${esc(s.title)}</span>
        <span class="${badgeClass(s.status)}">${esc(s.status)}</span>
      </div>
      <div class="ep-row">
        <div class="stepper">
          <button class="step-btn" data-action="dec" data-id="${s.id}" ${s.watched <= 0 ? 'disabled' : ''} aria-label="Decrease watched">−</button>
          <span class="ep-count"><strong>${s.watched}</strong>${totalLabel}</span>
          <button class="step-btn" data-action="inc" data-id="${s.id}" ${(s.total > 0 && s.watched >= s.total) ? 'disabled' : ''} aria-label="Increase watched">+</button>
        </div>
        ${starRow(s)}
        <div class="card-actions">
          <button class="icon-btn" data-action="edit" data-id="${s.id}" aria-label="Edit series">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
        </div>
      </div>
      <div class="progress"><div style="width:${pct}%"></div></div>
      <div class="progress-label">${s.total > 0 ? pct + '%' : 'no episode total set'}</div>
    </div>`;
}

function render() {
  const items = visibleSeries();
  renderStats();
  emptyEl.classList.toggle('hidden', series.length > 0);
  listEl.innerHTML = items.map(cardHTML).join('');
}

// --- Mutations ---------------------------------------------------------------
async function addSeries(title, total) {
  series.push({
    id: newId(),
    title: title.trim(),
    total: Math.max(0, total | 0),
    watched: 0,
    status: 'Plan to Watch',
    rating: 0,
    updatedAt: Date.now()
  });
  await saveSeries();
  render();
}

async function bump(id, delta) {
  const s = series.find(x => x.id === id);
  if (!s) return;
  const max = s.total > 0 ? s.total : Infinity;
  s.watched = Math.max(0, Math.min(max, s.watched + delta));
  if (s.total > 0 && s.watched >= s.total && s.status !== 'Completed') s.status = 'Completed';
  s.updatedAt = Date.now();
  await saveSeries();
  render();
}

async function rate(id, value) {
  const s = series.find(x => x.id === id);
  if (!s) return;
  // Clicking the current rating toggles it off.
  s.rating = (s.rating === value) ? 0 : value;
  s.updatedAt = Date.now();
  await saveSeries();
  render();
}

function openEdit(id) {
  const s = series.find(x => x.id === id);
  if (!s) return;
  editingId = id;
  editTitleEl.value = s.title;
  editTotalEl.value = s.total;
  editStatusEl.value = s.status;
  modal.classList.remove('hidden');
}

function closeEdit() {
  modal.classList.add('hidden');
  editingId = null;
}

async function saveEdit() {
  const s = series.find(x => x.id === editingId);
  if (!s) { closeEdit(); return; }
  const title = editTitleEl.value.trim();
  if (title) s.title = title;
  s.total = Math.max(0, parseInt(editTotalEl.value, 10) || 0);
  clampWatched(s);
  s.status = editStatusEl.value;
  s.updatedAt = Date.now();
  await saveSeries();
  closeEdit();
  render();
}

async function deleteEditing() {
  series = series.filter(x => x.id !== editingId);
  await saveSeries();
  closeEdit();
  render();
}

// --- Export / Import ---------------------------------------------------------
function downloadJson() {
  const payload = { app: 'WatchSync', version: 1, exportedAt: new Date().toISOString(), series };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'watchsync-export.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function isValidSeries(x) {
  return x && typeof x.title === 'string' && x.title.trim().length > 0;
}

async function importJson(file) {
  try {
    const text = await file.text();
    const payload = JSON.parse(text);
    const rows = Array.isArray(payload) ? payload : payload.series;
    if (!Array.isArray(rows)) throw new Error('bad format');
    const existing = new Set(series.map(s => s.title.toLowerCase()));
    let added = 0;
    for (const r of rows) {
      if (!isValidSeries(r)) continue;
      if (existing.has(r.title.trim().toLowerCase())) continue;
      series.push({
        id: newId(),
        title: r.title.trim().slice(0, 120),
        total: Math.max(0, parseInt(r.total, 10) || 0),
        watched: Math.max(0, parseInt(r.watched, 10) || 0),
        status: STATUSES.includes(r.status) ? r.status : 'Plan to Watch',
        rating: Math.max(0, Math.min(5, parseInt(r.rating, 10) || 0)),
        updatedAt: Date.now()
      });
      added++;
    }
    series.forEach(clampWatched);
    await saveSeries();
    render();
    searchEl.placeholder = added > 0 ? `Imported ${added} series…` : 'No new series to import';
    setTimeout(() => { searchEl.placeholder = 'Search series…'; }, 2500);
  } catch (e) {
    searchEl.placeholder = 'Import failed: invalid JSON';
    setTimeout(() => { searchEl.placeholder = 'Search series…'; }, 2500);
  }
}

// --- Events ------------------------------------------------------------------
addForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = addTitleEl.value.trim();
  if (!title) return;
  const total = Math.max(0, parseInt(addTotalEl.value, 10) || 0);
  await addSeries(title, total);
  addForm.reset();
  addTotalEl.value = 12;
  addTitleEl.focus();
});

searchEl.addEventListener('input', render);
filterEl.addEventListener('change', render);

listEl.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const { action, id } = btn.dataset;
  if (action === 'inc') bump(id, 1);
  else if (action === 'dec') bump(id, -1);
  else if (action === 'rate') rate(id, parseInt(btn.dataset.value, 10));
  else if (action === 'edit') openEdit(id);
});

editSaveBtn.addEventListener('click', saveEdit);
editCancelBtn.addEventListener('click', closeEdit);
editDeleteBtn.addEventListener('click', deleteEditing);
modal.addEventListener('click', (e) => { if (e.target === modal) closeEdit(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeEdit(); });

exportBtn.addEventListener('click', downloadJson);
importBtn.addEventListener('click', () => importFileEl.click());
importFileEl.addEventListener('change', () => {
  if (importFileEl.files[0]) importJson(importFileEl.files[0]);
  importFileEl.value = '';
});

// --- Init --------------------------------------------------------------------
(async function init() {
  await loadSeries();
  render();
})();
