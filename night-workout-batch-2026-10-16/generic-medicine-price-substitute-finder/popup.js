// Medicine Price Logbook — personal price entries only.
// Never suggests, compares, or recommends medicines or generics.
'use strict';

const STORE_KEY = 'medPriceEntries';
const form = document.getElementById('entry-form');
const listEl = document.getElementById('log-list');
const searchEl = document.getElementById('search');
const sortEl = document.getElementById('sort');

document.getElementById('med-date').valueAsDate = new Date();

/** @returns {Promise<Array>} all logged entries */
async function loadEntries() {
  const { [STORE_KEY]: entries = [] } = await chrome.storage.local.get(STORE_KEY);
  return entries;
}

/** Persist entries. */
async function saveEntries(entries) {
  await chrome.storage.local.set({ [STORE_KEY]: entries });
}

function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

/** Lowest price per medicine name (case-insensitive) -> set of entry ids */
function lowestIds(entries) {
  const best = new Map();
  for (const e of entries) {
    const k = e.name.trim().toLowerCase();
    if (!best.has(k) || e.price < best.get(k).price) best.set(k, e);
  }
  return new Set([...best.values()].map(e => e.id));
}

async function render() {
  const entries = await loadEntries();
  const q = searchEl.value.trim().toLowerCase();
  const mode = sortEl.value;
  const low = lowestIds(entries);

  let rows = entries.filter(e =>
    !q ||
    e.name.toLowerCase().includes(q) ||
    (e.pharmacy || '').toLowerCase().includes(q)
  );

  const by = {
    new: (a, b) => b.date.localeCompare(a.date) || b.created - a.created,
    old: (a, b) => a.date.localeCompare(b.date) || a.created - b.created,
    low: (a, b) => a.price - b.price,
    high: (a, b) => b.price - a.price,
  };
  rows.sort(by[mode] || by.new);

  if (!rows.length) {
    listEl.innerHTML = '<div class="empty">No entries yet — log the first price above.</div>';
    return;
  }

  listEl.innerHTML = rows.map(e => `
    <div class="entry">
      <div class="top">
        <span class="name">${esc(e.name)}
          ${low.has(e.id) ? '<span class="lowest">Lowest seen</span>' : ''}
        </span>
        <button class="del" data-id="${e.id}" title="Delete entry" aria-label="Delete entry">
          <svg viewBox="0 0 24 24" class="ic"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
        </button>
      </div>
      <div class="meta">${esc(e.pharmacy || '—')} · ${esc(e.date)} · ₹${Number(e.price).toFixed(2)}</div>
    </div>`).join('');
}

form.addEventListener('submit', async ev => {
  ev.preventDefault();
  const name = document.getElementById('med-name').value.trim();
  const price = parseFloat(document.getElementById('med-price').value);
  const date = document.getElementById('med-date').value;
  if (!name || Number.isNaN(price) || !date) return;
  const entries = await loadEntries();
  entries.push({
    id: Date.now() + '-' + Math.random().toString(36).slice(2, 8),
    name,
    pharmacy: document.getElementById('med-pharmacy').value.trim(),
    price,
    date,
    created: Date.now(),
  });
  await saveEntries(entries);
  form.reset();
  document.getElementById('med-date').valueAsDate = new Date();
  render();
});

listEl.addEventListener('click', async ev => {
  const btn = ev.target.closest('.del');
  if (!btn) return;
  const entries = await loadEntries();
  await saveEntries(entries.filter(e => e.id !== btn.dataset.id));
  render();
});

searchEl.addEventListener('input', render);
sortEl.addEventListener('change', render);

document.getElementById('export').addEventListener('click', async () => {
  const entries = await loadEntries();
  const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'medicine-price-log.json';
  a.click();
  URL.revokeObjectURL(a.href);
});

document.getElementById('clear').addEventListener('click', async () => {
  if (!confirm('Delete ALL logged entries?')) return;
  await saveEntries([]);
  render();
});

render();
