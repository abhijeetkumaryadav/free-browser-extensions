/* Sky Sighting Journal — personal logbook engine + UI.
   Honest scope: your entries only. No public database, no network. */

'use strict';

// ============================ ENGINE ============================
// Pure functions — headless-testable. Everything between markers.

// ENGINE-START

const MAX_DESC = 600;
const MAX_LOC = 80;

/** Create a sighting record. Returns {ok, entry} or {ok:false, error}. */
function makeSighting(date, shape, location, description) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: 'Pick a valid date.' };
  if (!shape || !shape.trim()) return { ok: false, error: 'Pick a shape.' };
  location = (location || '').trim();
  description = (description || '').trim();
  if (!description) return { ok: false, error: 'Describe what you saw.' };
  if (description.length > MAX_DESC) return { ok: false, error: 'Description is too long (max 600).' };
  if (location.length > MAX_LOC) location = location.slice(0, MAX_LOC);
  return {
    ok: true,
    entry: {
      id: 's' + Date.now() + Math.floor(Math.random() * 1e6),
      date, shape: shape.trim(), location, description,
      createdAt: Date.now()
    }
  };
}

/** Newest-first sort (immutable). */
function sortSightings(arr) {
  return [...arr].sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt - a.createdAt));
}

/** Filter by query (description/location) and shape. Query is case-insensitive. */
function filterSightings(arr, query, shape) {
  const q = (query || '').trim().toLowerCase();
  return arr.filter(s => {
    if (shape && s.shape !== shape) return false;
    if (!q) return true;
    return ((s.description || '') + ' ' + (s.location || '')).toLowerCase().includes(q);
  });
}

/** Count sightings per shape. */
function shapeCounts(arr) {
  const counts = {};
  for (const s of arr) counts[s.shape] = (counts[s.shape] || 0) + 1;
  return counts;
}

/** Human-readable date: "2026-10-17" -> "Oct 17, 2026". */
function fmtDate(iso) {
  const d = new Date(iso + 'T12:00:00');
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ENGINE-END

// ============================ UI ============================

const STORAGE_KEY = 'sky_sightings';
const $ = id => document.getElementById(id);

async function load() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  return Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY] : [];
}
async function save(list) {
  await chrome.storage.local.set({ [STORAGE_KEY]: list });
}

function render(list) {
  const q = $('search').value, shape = $('filterShape').value;
  const shown = filterSightings(sortSightings(list), q, shape);
  $('count').textContent = `${shown.length} sighting${shown.length === 1 ? '' : 's'}`;

  const counts = shapeCounts(list);
  $('stats').innerHTML = Object.keys(counts).length
    ? Object.entries(counts).map(([s, c]) => `<span class="chip">${escapeHtml(s)} · ${c}</span>`).join('')
    : '';

  $('list').innerHTML = shown.length
    ? shown.map(s => `
      <li class="item">
        <div class="top">
          <span class="shape">${escapeHtml(s.shape)}</span>
          <span class="date">${escapeHtml(fmtDate(s.date))}</span>
        </div>
        ${s.location ? `<div class="loc">📍 ${escapeHtml(s.location)}</div>` : ''}
        <div class="desc">${escapeHtml(s.description)}</div>
        <button class="del" data-id="${s.id}">delete</button>
      </li>`).join('')
    : '<li class="empty">No sightings yet. Log your first one above.</li>';
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

document.addEventListener('DOMContentLoaded', async () => {
  $('date').valueAsDate = new Date();
  let list = await load();

  const refresh = () => render(list);

  $('addBtn').addEventListener('click', async () => {
    $('err').hidden = true;
    const res = makeSighting($('date').value, $('shape').value, $('location').value, $('description').value);
    if (!res.ok) { $('err').textContent = res.error; $('err').hidden = false; return; }
    list.push(res.entry);
    await save(list);
    $('location').value = ''; $('description').value = '';
    refresh();
  });

  $('search').addEventListener('input', refresh);
  $('filterShape').addEventListener('change', refresh);

  $('list').addEventListener('click', async e => {
    const btn = e.target.closest('.del');
    if (!btn) return;
    list = list.filter(s => s.id !== btn.dataset.id);
    await save(list);
    refresh();
  });

  $('clearBtn').addEventListener('click', async () => {
    if (!list.length) return;
    if (confirm('Delete all sightings from your logbook?')) { list = []; await save(list); refresh(); }
  });

  refresh();
});
