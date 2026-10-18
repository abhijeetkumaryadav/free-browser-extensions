/* Journal Metric Logbook — popup.js
 * Manual journal logbook. All metrics are typed by the user and stored in
 * chrome.storage.local. Sorting and change-tracking happen client-side only.
 * There is NO live journal-metrics API — the UI states this clearly.
 */

const KEY = 'journalLogbook.v1';

const $ = (sel) => document.querySelector(sel);

/** Load the journal array from storage. */
async function load() {
  const data = await chrome.storage.local.get(KEY);
  return Array.isArray(data[KEY]) ? data[KEY] : [];
}

/** Persist the journal array. */
async function save(journals) {
  await chrome.storage.local.set({ [KEY]: journals });
}

function uid() {
  return 'j' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function fmtNum(v) {
  if (v === null || v === undefined || v === '' || Number.isNaN(Number(v))) return '—';
  return String(v);
}

function fmtDate(ts) {
  if (!ts) return '—';
  try { return new Date(ts).toLocaleDateString(undefined, { dateStyle: 'medium' }); }
  catch { return '—'; }
}

/** Sort journals by the active criterion. */
function sortJournals(list, mode) {
  const copy = [...list];
  switch (mode) {
    case 'sjr':   return copy.sort((a, b) => (b.sjr ?? -1) - (a.sjr ?? -1));
    case 'name':  return copy.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    case 'recent':return copy.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    case 'if':
    default:      return copy.sort((a, b) => (b.impactFactor ?? -1) - (a.impactFactor ?? -1));
  }
}

/** Render the journal cards. */
function render(list, sortMode) {
  const wrap = $('#journal-list');
  const empty = $('#empty');
  const sorted = sortJournals(list, sortMode);
  wrap.innerHTML = '';
  empty.classList.toggle('hidden', sorted.length > 0);

  sorted.forEach((j, rank) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="title">#${rank + 1} ${esc(j.name)}</div>
      ${j.publisher ? `<div class="pub">${esc(j.publisher)}</div>` : ''}
      <div class="metrics">
        <div class="metric"><div class="k">Impact factor</div><div class="v">${esc(fmtNum(j.impactFactor))}</div></div>
        <div class="metric"><div class="k">SJR</div><div class="v">${esc(fmtNum(j.sjr))}</div></div>
        <div class="metric"><div class="k">Accept %</div><div class="v">${esc(fmtNum(j.acceptanceRate))}</div></div>
      </div>
      ${j.notes ? `<div class="notes">“${esc(j.notes)}”</div>` : ''}
      <div class="updated">Updated ${esc(fmtDate(j.updatedAt))}</div>
      <div class="card-actions">
        <button class="btn ghost edit-btn">Edit</button>
        <button class="btn ghost del">Delete</button>
      </div>`;
    card.querySelector('.edit-btn').addEventListener('click', () => startEdit(j.id));
    card.querySelector('.del').addEventListener('click', () => removeJournal(j.id));
    wrap.appendChild(card);
  });
}

/** Prefill the form for editing an existing journal. */
async function startEdit(id) {
  const list = await load();
  const j = list.find((x) => x.id === id);
  if (!j) return;
  $('#edit-id').value = j.id;
  $('#f-name').value = j.name || '';
  $('#f-publisher').value = j.publisher || '';
  $('#f-if').value = j.impactFactor ?? '';
  $('#f-sjr').value = j.sjr ?? '';
  $('#f-acc').value = j.acceptanceRate ?? '';
  $('#f-notes').value = j.notes || '';
  $('#cancel-edit').classList.remove('hidden');
  switchTab('add');
}

/** Delete a journal after a native confirm. */
async function removeJournal(id) {
  if (!confirm('Delete this journal from your logbook?')) return;
  const list = await load();
  await save(list.filter((x) => x.id !== id));
  await refresh();
}

/** Read form fields into a journal object. */
function readForm() {
  const num = (id) => {
    const raw = $(id).value.trim();
    return raw === '' ? null : Number(raw);
  };
  return {
    name: $('#f-name').value.trim(),
    publisher: $('#f-publisher').value.trim(),
    impactFactor: num('#f-if'),
    sjr: num('#f-sjr'),
    acceptanceRate: num('#f-acc'),
    notes: $('#f-notes').value.trim(),
  };
}

function resetForm() {
  $('#journal-form').reset();
  $('#edit-id').value = '';
  $('#cancel-edit').classList.add('hidden');
}

function switchTab(name) {
  document.querySelectorAll('.tab').forEach((t) =>
    t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.panel').forEach((p) =>
    p.classList.toggle('active', p.id === 'tab-' + name));
}

async function refresh() {
  const list = await load();
  render(list, $('#sort-by').value);
}

function exportCSV(list) {
  const header = ['Name', 'Publisher', 'Impact factor', 'SJR', 'Acceptance %', 'Notes', 'Updated'];
  const rows = list.map((j) => [
    j.name, j.publisher, j.impactFactor ?? '', j.sjr ?? '',
    j.acceptanceRate ?? '', j.notes, fmtDate(j.updatedAt),
  ]);
  const csv = [header, ...rows]
    .map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'journal-logbook.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

document.addEventListener('DOMContentLoaded', async () => {
  document.querySelectorAll('.tab').forEach((t) =>
    t.addEventListener('click', () => switchTab(t.dataset.tab)));

  $('#sort-by').addEventListener('change', refresh);

  $('#export-csv').addEventListener('click', async () => {
    const list = await load();
    if (!list.length) { alert('Nothing to export yet.'); return; }
    exportCSV(sortJournals(list, $('#sort-by').value));
  });

  $('#cancel-edit').addEventListener('click', () => {
    resetForm();
    switchTab('journals');
  });

  $('#journal-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = readForm();
    if (!data.name) { alert('Journal name is required.'); return; }
    const list = await load();
    const editId = $('#edit-id').value;
    if (editId) {
      const idx = list.findIndex((x) => x.id === editId);
      if (idx >= 0) list[idx] = { ...list[idx], ...data, updatedAt: Date.now() };
    } else {
      list.push({ id: uid(), addedAt: Date.now(), updatedAt: Date.now(), ...data });
    }
    await save(list);
    resetForm();
    switchTab('journals');
    await refresh();
  });

  await refresh();
});
