/* SnapDiff — diff two pasted CSV snapshots by a key column.
 * Shows added / removed / changed rows with cell-level highlighting.
 * Manual snapshots only: no Sheets API, no network. All on-device. */
'use strict';

const els = {
  beforeInput: document.getElementById('beforeInput'),
  afterInput: document.getElementById('afterInput'),
  keySelect: document.getElementById('keySelect'),
  ignoreCase: document.getElementById('ignoreCase'),
  diffBtn: document.getElementById('diffBtn'),
  resultCard: document.getElementById('resultCard'),
  statsRow: document.getElementById('statsRow'),
  filters: document.getElementById('filters'),
  exportBtn: document.getElementById('exportBtn'),
  diffList: document.getElementById('diffList')
};

let lastDiff = null;   // { headers, keyIdx, added, removed, changed }
let activeFilters = new Set(['added', 'removed', 'changed']);

/* ---------- CSV parsing (quote-aware, single pass) ---------- */

function parseCSV(text) {
  const rows = [];
  let field = '', record = [], inQuotes = false, i = 0;
  // Normalize newlines first.
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === ',') { record.push(field); field = ''; i++; continue; }
    if (c === '\n') { record.push(field); rows.push(record); record = []; field = ''; i++; continue; }
    field += c; i++;
  }
  if (field !== '' || record.length > 0) { record.push(field); rows.push(record); }
  // Drop a single trailing empty line artifact.
  while (rows.length && rows[rows.length - 1].every(c => c === '')) rows.pop();
  return rows;
}

function normalizeWidths(rows) {
  const w = Math.max(...rows.map(r => r.length), 0);
  rows.forEach(r => { while (r.length < w) r.push(''); });
  return w;
}

/* ---------- Key column dropdown ---------- */

function refreshKeyOptions() {
  const rows = parseCSV(els.beforeInput.value.trim() || els.afterInput.value.trim());
  if (!rows.length) {
    els.keySelect.innerHTML = '<option value="">— paste data first —</option>';
    return;
  }
  const width = normalizeWidths(rows);
  const headers = rows[0];
  els.keySelect.innerHTML = headers.map((h, i) =>
    `<option value="${i}">${escapeHtml(h || 'Column ' + (i + 1))}</option>`).join('');
  els.keySelect.value = '0';
}

['beforeInput', 'afterInput'].forEach(id => {
  let t = null;
  document.getElementById(id).addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(refreshKeyOptions, 400);
  });
});

/* ---------- Diff engine ---------- */

function keyOf(row, idx, ignoreCase) {
  const v = (row[idx] || '').trim();
  return ignoreCase ? v.toLowerCase() : v;
}

function computeDiff() {
  const before = parseCSV(els.beforeInput.value.trim());
  const after = parseCSV(els.afterInput.value.trim());
  if (!before.length || !after.length) {
    showEmpty('Paste both snapshots first.');
    return;
  }
  const keyIdx = parseInt(els.keySelect.value, 10);
  if (isNaN(keyIdx)) { showEmpty('Pick a key column.'); return; }
  const ignoreCase = els.ignoreCase.checked;

  const width = Math.max(normalizeWidths(before), normalizeWidths(after));
  const headers = before[0].length >= after[0].length ? before[0] : after[0];

  const beforeMap = new Map(), afterMap = new Map();
  const dupKeys = new Set();
  const addTo = (map, row) => {
    const k = keyOf(row, keyIdx, ignoreCase);
    if (map.has(k)) dupKeys.add(k); else map.set(k, row);
  };
  before.slice(1).forEach(r => addTo(beforeMap, r));
  after.slice(1).forEach(r => addTo(afterMap, r));

  const added = [], removed = [], changed = [];
  for (const [k, row] of afterMap) {
    if (!beforeMap.has(k)) { added.push({ key: k, row }); continue; }
    const oldRow = beforeMap.get(k);
    const cellDiffs = [];
    for (let c = 0; c < width; c++) {
      if (c === keyIdx) continue;
      const o = oldRow[c] || '', n = row[c] || '';
      if (o !== n) cellDiffs.push({ col: c, old: o, new: n });
    }
    if (cellDiffs.length) changed.push({ key: k, oldRow, newRow: row, cellDiffs });
  }
  for (const [k, row] of beforeMap) {
    if (!afterMap.has(k)) removed.push({ key: k, row });
  }

  lastDiff = { headers, keyIdx, width, added, removed, changed, dupKeys: [...dupKeys] };
  renderResults();
}

function renderResults() {
  const d = lastDiff;
  if (!d) return;
  els.resultCard.classList.remove('hidden');

  const total = d.added.length + d.removed.length + d.changed.length;
  els.statsRow.innerHTML =
    `<span class="stat added">Added<b>${d.added.length}</b></span>` +
    `<span class="stat removed">Removed<b>${d.removed.length}</b></span>` +
    `<span class="stat changed">Changed<b>${d.changed.length}</b></span>` +
    `<span class="stat">Total<b>${total}</b></span>` +
    (d.dupKeys.length ? `<span class="stat">Dup keys<b>${d.dupKeys.length}</b></span>` : '');

  renderList();
}

function renderList() {
  const d = lastDiff;
  let html = '';
  const item = (type, inner) => `<div class="drow ${type}">${inner}</div>`;

  if (activeFilters.has('added')) {
    for (const a of d.added) {
      html += item('added',
        `<div class="dkey">+ ${escapeHtml(displayKey(a.key))}</div>` +
        `<div class="dcells">${rowCells(a.row, d, 'val')}</div>`);
    }
  }
  if (activeFilters.has('removed')) {
    for (const r of d.removed) {
      html += item('removed',
        `<div class="dkey">− ${escapeHtml(displayKey(r.key))}</div>` +
        `<div class="dcells">${rowCells(r.row, d, 'val')}</div>`);
    }
  }
  if (activeFilters.has('changed')) {
    for (const c of d.changed) {
      const cells = c.cellDiffs.map(cd =>
        `<div class="dcell"><span class="col">${escapeHtml(d.headers[cd.col] || 'Col ' + (cd.col + 1))}</span>` +
        `<span class="old">${escapeHtml(trunc(cd.old))}</span><span class="arrow">→</span>` +
        `<span class="new">${escapeHtml(trunc(cd.new))}</span></div>`).join('');
      html += item('changed',
        `<div class="dkey">~ ${escapeHtml(displayKey(c.key))} <span style="color:var(--muted);font-weight:400">(${c.cellDiffs.length} cell${c.cellDiffs.length > 1 ? 's' : ''})</span></div>` +
        `<div class="dcells">${cells}</div>`);
    }
  }
  els.diffList.innerHTML = html || '<p class="empty">No differences in the visible categories.</p>';
}

function rowCells(row, d, cls) {
  let out = '';
  for (let c = 0; c < d.width; c++) {
    if (c === d.keyIdx) continue;
    const v = row[c] || '';
    if (v === '') continue;
    out += `<div class="dcell"><span class="col">${escapeHtml(d.headers[c] || 'Col ' + (c + 1))}</span>` +
           `<span class="${cls}">${escapeHtml(trunc(v))}</span></div>`;
  }
  return out || '<div class="dcell"><span class="val" style="color:var(--muted)">(empty row)</span></div>';
}

function displayKey(k) { return k === '' ? '(blank key)' : k; }
function trunc(s) { s = String(s); return s.length > 120 ? s.slice(0, 120) + '…' : s; }

function showEmpty(msg) {
  lastDiff = null;
  els.resultCard.classList.remove('hidden');
  els.statsRow.innerHTML = '';
  els.diffList.innerHTML = `<p class="empty">${escapeHtml(msg)}</p>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

/* ---------- Export ---------- */

function exportDiff() {
  const d = lastDiff;
  if (!d) return;
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = ['change_type,key,' + d.headers.map(q).join(',')];
  const rowToCsv = r => Array.from({ length: d.width }, (_, c) => q(r[c] || '')).join(',');
  for (const a of d.added) lines.push(['added', q(a.key), rowToCsv(a.row)].join(','));
  for (const r of d.removed) lines.push(['removed', q(r.key), rowToCsv(r.row)].join(','));
  for (const c of d.changed) {
    // one line per changed cell for a precise report
    for (const cd of c.cellDiffs) {
      lines.push(['changed', q(c.key), q(d.headers[cd.col] || ('Col ' + (cd.col + 1))), q(cd.old), q(cd.new)].join(','));
    }
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'snapshot-diff.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

/* ---------- Events ---------- */

els.diffBtn.addEventListener('click', computeDiff);
els.exportBtn.addEventListener('click', exportDiff);
els.filters.addEventListener('click', e => {
  const btn = e.target.closest('.fbtn');
  if (!btn) return;
  const f = btn.dataset.f;
  if (activeFilters.has(f)) { activeFilters.delete(f); btn.classList.remove('active'); }
  else { activeFilters.add(f); btn.classList.add('active'); }
  renderList();
});

// Restore last inputs ( convenience; data stays local )
chrome.storage.local.get(['snapBefore', 'snapAfter'], r => {
  if (r.snapBefore) { els.beforeInput.value = r.snapBefore; }
  if (r.snapAfter) { els.afterInput.value = r.snapAfter; }
  if (r.snapBefore || r.snapAfter) refreshKeyOptions();
});
let saveTimer = null;
const persist = () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    chrome.storage.local.set({ snapBefore: els.beforeInput.value, snapAfter: els.afterInput.value });
  }, 800);
};
els.beforeInput.addEventListener('input', persist);
els.afterInput.addEventListener('input', persist);
