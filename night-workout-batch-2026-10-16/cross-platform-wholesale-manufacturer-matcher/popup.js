/* Supplier Book — manual supplier contact book with search + comparison matrix. */
'use strict';

const $ = (id) => document.getElementById(id);
const store = chrome.storage.local;

/* ---------- helpers ---------- */

/** Case-insensitive multi-field search across stored suppliers. */
function matches(s, q) {
  const hay = [s.name, s.platform, s.product, s.contact, s.notes].join(' ').toLowerCase();
  return q.split(/\s+/).every((tok) => hay.includes(tok));
}

/** Rank: prefix hits first, then recency (stable tie-break by insertion order). */
function rank(suppliers, q) {
  return suppliers
    .map((s, i) => {
      let score = 0;
      if (q) {
        const name = (s.name || '').toLowerCase();
        if (name.startsWith(q)) score += 3;
        else if (name.includes(q)) score += 2;
        else score += 1;
      }
      return { s, score, i };
    })
    .sort((a, b) => b.score - a.score || b.i - a.i)
    .map((r) => r.s);
}

/** Build comparison matrix: for each product, rows of (supplier, price, MOQ, platform). */
function comparisonMatrix(suppliers) {
  const groups = new Map();
  for (const s of suppliers) {
    const key = (s.product || '—').trim().toLowerCase() || '—';
    if (!groups.has(key)) groups.set(key, { product: s.product || '—', rows: [] });
    groups.get(key).rows.push(s);
  }
  return [...groups.values()];
}

/* ---------- rendering ---------- */

function esc(t) {
  return String(t || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function entryHTML(s) {
  return `
    <div class="entry">
      <div class="top">
        <span class="name">${esc(s.name)}</span>
        ${s.platform ? `<span class="plat">${esc(s.platform)}</span>` : ''}
      </div>
      <div class="meta">
        ${s.product ? `<span>📦 ${esc(s.product)}</span>` : ''}
        ${s.price ? `<span>💰 ${esc(s.price)}</span>` : ''}
        ${s.moq ? `<span>📊 MOQ ${esc(s.moq)}</span>` : ''}
        ${s.contact ? `<span>📞 ${esc(s.contact)}</span>` : ''}
      </div>
      ${s.notes ? `<div class="notes">${esc(s.notes)}</div>` : ''}
      <button class="del" data-id="${s.id}">delete</button>
    </div>`;
}

async function refresh() {
  const { suppliers = [] } = await store.get('suppliers');
  const q = $('search').value.trim().toLowerCase();

  $('stSup').textContent = suppliers.length;
  $('stProd').textContent = new Set(suppliers.map((s) => (s.product || '').toLowerCase()).filter(Boolean)).size;
  $('stPlat').textContent = new Set(suppliers.map((s) => (s.platform || '').toLowerCase()).filter(Boolean)).size;

  const filtered = rank(suppliers.filter((s) => !q || matches(s, q)), q);
  const list = $('list');
  if (filtered.length === 0) {
    list.innerHTML = `<div class="empty">${q ? 'No suppliers match your search.' : 'No suppliers yet — add your first one above.'}</div>`;
  } else {
    list.innerHTML = filtered.map(entryHTML).join('');
    list.querySelectorAll('.del').forEach((btn) => {
      btn.onclick = async () => {
        const { suppliers: cur = [] } = await store.get('suppliers');
        await store.set({ suppliers: cur.filter((s) => String(s.id) !== btn.dataset.id) });
        refresh();
      };
    });
  }

  // store comparison matrix for a possible future view — also exposed on window for tests
  window.__matrix = comparisonMatrix(suppliers);
}

/* ---------- events ---------- */

$('addBtn').addEventListener('click', async () => {
  const name = $('fName').value.trim();
  if (!name) { $('fName').focus(); return; }
  const s = {
    id: Date.now(),
    name,
    platform: $('fPlatform').value.trim(),
    product: $('fProduct').value.trim(),
    price: $('fPrice').value.trim(),
    moq: $('fMoq').value.trim(),
    contact: $('fContact').value.trim(),
    notes: $('fNotes').value.trim()
  };
  const { suppliers = [] } = await store.get('suppliers');
  suppliers.push(s);
  await store.set({ suppliers });
  ['fName', 'fPlatform', 'fProduct', 'fPrice', 'fMoq', 'fContact', 'fNotes'].forEach((id) => { $(id).value = ''; });
  refresh();
});

$('search').addEventListener('input', refresh);

$('clearBtn').addEventListener('click', async () => {
  if (confirm('Delete all suppliers?')) {
    await store.remove('suppliers');
    refresh();
  }
});

refresh();

// Exported for Node smoke tests (window guards the browser-only calls above).
if (typeof module !== 'undefined') module.exports = { matches, rank, comparisonMatrix };
