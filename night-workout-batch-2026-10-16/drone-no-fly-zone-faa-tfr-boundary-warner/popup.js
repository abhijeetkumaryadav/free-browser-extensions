/* Drone Airspace Guide — no-fly notes engine + UI.
   Honest scope: educational guide + your own notes. No live TFRs, no network. */

'use strict';

// ============================ ENGINE ============================
// Pure functions — headless-testable. Everything between markers.

// ENGINE-START

const MAX_AREA = 80;
const MAX_REASON = 200;

/** Create a no-fly note. Returns {ok, entry} or {ok:false, error}. */
function makeNote(area, reason) {
  area = (area || '').trim();
  reason = (reason || '').trim();
  if (!area) return { ok: false, error: 'Give the area a name.' };
  if (area.length > MAX_AREA) return { ok: false, error: 'Area name is too long (max 80).' };
  if (reason.length > MAX_REASON) return { ok: false, error: 'Reason is too long (max 200).' };
  return {
    ok: true,
    entry: {
      id: 'n' + Date.now() + Math.floor(Math.random() * 1e6),
      area, reason,
      createdAt: Date.now()
    }
  };
}

/** Newest-first sort (immutable). */
function sortNotes(arr) {
  return [...arr].sort((a, b) => b.createdAt - a.createdAt);
}

/** Case-insensitive search across area + reason. */
function filterNotes(arr, query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return [...arr];
  return arr.filter(n => ((n.area || '') + ' ' + (n.reason || '')).toLowerCase().includes(q));
}

/** Human-readable datetime. */
function fmtWhen(ts) {
  const d = new Date(ts);
  if (isNaN(d)) return '';
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

// ENGINE-END

// ============================ UI ============================

const STORAGE_KEY = 'drone_nofly_notes';
const $ = id => document.getElementById(id);

async function load() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  return Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY] : [];
}
async function save(list) {
  await chrome.storage.local.set({ [STORAGE_KEY]: list });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function render(list) {
  const shown = filterNotes(sortNotes(list), $('search').value);
  $('count').textContent = `${shown.length} note${shown.length === 1 ? '' : 's'}`;
  $('list').innerHTML = shown.length
    ? shown.map(n => `
      <li class="item">
        <div class="top">
          <span class="area">⛔ ${escapeHtml(n.area)}</span>
          <span class="date">${escapeHtml(fmtWhen(n.createdAt))}</span>
        </div>
        ${n.reason ? `<div class="reason">${escapeHtml(n.reason)}</div>` : ''}
        <button class="del" data-id="${n.id}">delete</button>
      </li>`).join('')
    : '<li class="empty">No notes yet. Add areas you personally avoid.</li>';
}

document.addEventListener('DOMContentLoaded', async () => {
  let list = await load();
  const refresh = () => render(list);

  $('addBtn').addEventListener('click', async () => {
    $('err').hidden = true;
    const res = makeNote($('area').value, $('reason').value);
    if (!res.ok) { $('err').textContent = res.error; $('err').hidden = false; return; }
    list.push(res.entry);
    await save(list);
    $('area').value = ''; $('reason').value = '';
    refresh();
  });

  $('search').addEventListener('input', refresh);

  $('list').addEventListener('click', async e => {
    const btn = e.target.closest('.del');
    if (!btn) return;
    list = list.filter(n => n.id !== btn.dataset.id);
    await save(list);
    refresh();
  });

  $('clearBtn').addEventListener('click', async () => {
    if (!list.length) return;
    if (confirm('Delete all no-fly notes?')) { list = []; await save(list); refresh(); }
  });

  refresh();
});
