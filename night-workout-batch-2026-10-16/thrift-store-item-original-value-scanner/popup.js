/* ThriftValue popup — manual thrift-find logbook. All state in chrome.storage.local. */
const ITEMS_KEY = 'thrift_items'; // [{id, name, paid, original, category, store, notes, ts}]

const $ = (id) => document.getElementById(id);
let items = [];

const uid = () => Math.random().toString(36).slice(2, 10);
const money = (n) => '$' + (Number(n) || 0).toFixed(2);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* ---------- persistence ---------- */
async function load() {
  items = (await chrome.storage.local.get(ITEMS_KEY))[ITEMS_KEY] || [];
}
async function save() {
  await chrome.storage.local.set({ [ITEMS_KEY]: items });
}

/* ---------- stats ---------- */
function totals(list) {
  const paid = list.reduce((a, i) => a + i.paid, 0);
  const retail = list.reduce((a, i) => a + i.original, 0);
  const saved = Math.max(0, retail - paid);
  const pct = retail > 0 ? Math.round((saved / retail) * 100) : 0;
  return { paid, retail, saved, pct };
}

function renderStats() {
  const t = totals(items);
  $('stat-saved').textContent = money(t.saved);
  $('stat-saved-sub').textContent = t.pct + '% off retail (your estimates)';
  $('stat-paid').textContent = money(t.paid);
  $('stat-retail').textContent = money(t.retail);
  $('stat-count').textContent = items.length;
}

/* ---------- list ---------- */
function sortedItems() {
  const mode = $('sort-select').value;
  const arr = [...items];
  const marginPct = (i) => (i.original > 0 ? ((i.original - i.paid) / i.original) : 0);
  if (mode === 'newest') arr.sort((a, b) => b.ts - a.ts);
  if (mode === 'savings') arr.sort((a, b) => (b.original - b.paid) - (a.original - a.paid));
  if (mode === 'margin') arr.sort((a, b) => marginPct(b) - marginPct(a));
  if (mode === 'paid') arr.sort((a, b) => b.paid - a.paid);
  return arr;
}

function renderList() {
  const list = $('item-list');
  const arr = sortedItems();
  if (!arr.length) {
    list.innerHTML = '<div class="empty">No finds logged yet. Switch to "Log a find" to add your first treasure.</div>';
    return;
  }
  list.innerHTML = arr.map(i => {
    const saved = Math.max(0, i.original - i.paid);
    const pct = i.original > 0 ? Math.round((saved / i.original) * 100) : 0;
    const sub = [i.category, i.store, i.notes].filter(Boolean).map(esc).join(' · ');
    const date = new Date(i.ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    return `
    <div class="item" data-id="${i.id}">
      <div class="meta">
        <div class="name">${esc(i.name)}</div>
        <div class="sub">${sub || 'No details'} · ${date}</div>
        <div class="sub">Paid ${money(i.paid)} · your est. ${money(i.original)}</div>
      </div>
      <div class="margin">
        <div class="saved">+${money(saved)}</div>
        <div class="pct">${pct}% off</div>
      </div>
      <button class="del" data-del="${i.id}" title="Remove">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
      </button>
    </div>`;
  }).join('');
}

function renderAll() { renderStats(); renderList(); }

/* ---------- actions ---------- */
async function addItem() {
  const name = $('f-name').value.trim();
  const paid = parseFloat($('f-paid').value);
  const original = parseFloat($('f-original').value);
  if (!name) { $('f-name').focus(); return; }
  if (isNaN(paid) || paid < 0) { $('f-paid').focus(); return; }
  if (isNaN(original) || original < 0) { $('f-original').focus(); return; }
  items.push({
    id: uid(), name, paid, original,
    category: $('f-category').value,
    store: $('f-store').value.trim(),
    notes: $('f-notes').value.trim(),
    ts: Date.now()
  });
  await save();
  ['f-name','f-paid','f-original','f-store','f-notes'].forEach(id => $(id).value = '');
  updateLiveMath();
  renderAll();
}

function updateLiveMath() {
  const paid = parseFloat($('f-paid').value);
  const original = parseFloat($('f-original').value);
  const box = $('live-math');
  if (isNaN(paid) || isNaN(original)) {
    box.textContent = 'Enter paid + estimated original to see the margin.';
    return;
  }
  const saved = Math.max(0, original - paid);
  const pct = original > 0 ? Math.round((saved / original) * 100) : 0;
  box.innerHTML = `Estimated saving: <strong>${money(saved)}</strong> (${pct}% off your estimated original)`;
}

function exportCSV() {
  if (!items.length) return;
  const escCsv = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [['Name','Category','Store','Paid','Estimated Original','Saved','Margin %','Notes','Date']];
  items.forEach(i => {
    const saved = Math.max(0, i.original - i.paid);
    const pct = i.original > 0 ? Math.round((saved / i.original) * 100) : 0;
    rows.push([i.name, i.category, i.store, i.paid.toFixed(2), i.original.toFixed(2), saved.toFixed(2), pct, i.notes, new Date(i.ts).toISOString()]);
  });
  const blob = new Blob([rows.map(r => r.map(escCsv).join(',')).join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'thrift-finds.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

async function clearAll() {
  if (!items.length) return;
  if (!confirm('Delete all logged finds? This cannot be undone.')) return;
  items = [];
  await save();
  renderAll();
}

/* ---------- wiring ---------- */
document.addEventListener('DOMContentLoaded', async () => {
  await load();
  renderAll();

  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      $('pane-' + tab.dataset.tab).classList.add('active');
    });
  });

  $('add-btn').addEventListener('click', addItem);
  $('f-paid').addEventListener('input', updateLiveMath);
  $('f-original').addEventListener('input', updateLiveMath);
  $('f-name').addEventListener('keydown', e => { if (e.key === 'Enter') addItem(); });
  $('sort-select').addEventListener('change', renderList);
  $('export-btn').addEventListener('click', exportCSV);
  $('clear-btn').addEventListener('click', clearAll);

  document.addEventListener('click', async (e) => {
    const del = e.target.closest('[data-del]');
    if (!del) return;
    items = items.filter(i => i.id !== del.dataset.del);
    await save();
    renderAll();
  });
});
