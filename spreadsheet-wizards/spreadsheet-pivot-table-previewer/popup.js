/* PivotLens — CSV pivot table previewer. All on-device, no network. */
(function () {
  'use strict';

  // ---------- DOM ----------
  const csvInput = document.getElementById('csv-input');
  const parseBtn = document.getElementById('parse-btn');
  const sampleBtn = document.getElementById('load-sample');
  const parseError = document.getElementById('parse-error');
  const rowCountEl = document.getElementById('row-count');
  const configPanel = document.getElementById('config-panel');
  const resultPanel = document.getElementById('result-panel');
  const rowField = document.getElementById('row-field');
  const colField = document.getElementById('col-field');
  const valField = document.getElementById('val-field');
  const aggSel = document.getElementById('agg');
  const buildBtn = document.getElementById('build-btn');
  const exportBtn = document.getElementById('export-btn');
  const pivotTable = document.getElementById('pivot-table');
  const pivotMeta = document.getElementById('pivot-meta');

  // ---------- State ----------
  let headers = [];   // string[]
  let rows = [];      // string[][]
  let lastPivot = null; // { rowLabels, colLabels, matrix, rowTotals, colTotals, grand }

  const SAMPLE =
    'Region,Product,Quarter,Sales\n' +
    'North,Apples,Q1,120\nNorth,Pears,Q1,60\nSouth,Apples,Q1,95\n' +
    'North,Apples,Q2,140\nSouth,Pears,Q2,80\nSouth,Apples,Q2,110\n' +
    'North,Pears,Q2,75\nSouth,Pears,Q1,55';

  // ---------- CSV parsing (handles quoted fields + escaped quotes) ----------
  function parseCSV(text) {
    const out = [];
    let row = [], field = '', inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else inQuotes = false;
        } else field += c;
      } else if (c === '"') {
        inQuotes = true;
      } else if (c === ',') {
        row.push(field); field = '';
      } else if (c === '\r') {
        // ignore, handled by \n
      } else if (c === '\n') {
        row.push(field); field = '';
        if (row.some(v => v.trim() !== '')) out.push(row);
        row = [];
      } else field += c;
    }
    if (field !== '' || row.length) {
      row.push(field);
      if (row.some(v => v.trim() !== '')) out.push(row);
    }
    return out;
  }

  function showError(msg) {
    parseError.textContent = msg;
    parseError.classList.remove('hidden');
  }
  function clearError() { parseError.classList.add('hidden'); parseError.textContent = ''; }

  function fillSelects() {
    [rowField, colField, valField].forEach(s => { s.innerHTML = ''; });
    headers.forEach((h, i) => {
      const label = h || ('Column ' + (i + 1));
      rowField.add(new Option(label, i));
      colField.add(new Option(label, i));
      valField.add(new Option(label, i));
    });
    // Add "(none)" option to the column field for single-column summaries.
    colField.add(new Option('(none)', '-1'));
    // Sensible defaults: first col = rows, second = columns, last = values.
    if (headers.length >= 1) rowField.selectedIndex = 0;
    if (headers.length >= 2) colField.selectedIndex = 1;
    if (headers.length >= 1) valField.selectedIndex = headers.length - 1;
  }

  // ---------- Pivot engine ----------
  function aggregate(values, fn) {
    if (fn === 'count') return values.length;
    const nums = values.map(Number).filter(n => !Number.isNaN(n));
    if (!nums.length) return 0;
    if (fn === 'sum') return nums.reduce((a, b) => a + b, 0);
    if (fn === 'avg') return nums.reduce((a, b) => a + b, 0) / nums.length;
    if (fn === 'min') return Math.min.apply(null, nums);
    if (fn === 'max') return Math.max.apply(null, nums);
    return 0;
  }

  function formatNum(n) {
    if (typeof n !== 'number') return n;
    if (!Number.isFinite(n)) return '—';
    return Number.isInteger(n) ? n.toLocaleString('en-US')
      : n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }

  function buildPivot() {
    const rIdx = parseInt(rowField.value, 10);
    const cIdx = parseInt(colField.value, 10);
    const vIdx = parseInt(valField.value, 10);
    const agg = aggSel.value;
    const hasCols = cIdx >= 0;

    // Collect distinct row/column labels, preserving first-seen order.
    const rowOrder = [], colOrder = [];
    const rowSeen = new Set(), colSeen = new Set();
    const cells = new Map(); // "r\x00c" -> string[] of raw values

    rows.forEach(r => {
      const rl = (r[rIdx] !== undefined ? r[rIdx] : '').trim() || '(blank)';
      const cl = hasCols ? ((r[cIdx] !== undefined ? r[cIdx] : '').trim() || '(blank)') : '';
      if (!rowSeen.has(rl)) { rowSeen.add(rl); rowOrder.push(rl); }
      if (hasCols && !colSeen.has(cl)) { colSeen.add(cl); colOrder.push(cl); }
      const key = rl + '\x00' + cl;
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key).push(vIdx < r.length ? r[vIdx] : '');
    });

    const colLabels = hasCols ? colOrder : [''];
    const matrix = rowOrder.map(rl =>
      colLabels.map(cl => aggregate(cells.get(rl + '\x00' + cl) || [], agg))
    );

    // Row totals: re-aggregate across the row's columns (correct for avg/min/max).
    const rowTotals = rowOrder.map((rl, i) => {
      const all = [];
      colLabels.forEach(cl => { all.push.apply(all, cells.get(rl + '\x00' + cl) || []); });
      return aggregate(all, agg);
    });
    // Column totals similarly.
    const colTotals = colLabels.map((cl, j) => {
      const all = [];
      rowOrder.forEach(rl => { all.push.apply(all, cells.get(rl + '\x00' + cl) || []); });
      return aggregate(all, agg);
    });
    // Grand total over everything.
    const grand = aggregate([].concat.apply([], Array.from(cells.values())), agg);

    lastPivot = { rowLabels: rowOrder, colLabels, matrix, rowTotals, colTotals, grand, agg };
    renderPivot();
    exportBtn.disabled = false;
  }

  function renderPivot() {
    const p = lastPivot;
    if (!p) return;
    const rowName = headers[parseInt(rowField.value, 10)] || 'Row';
    const colName = parseInt(colField.value, 10) >= 0
      ? (headers[parseInt(colField.value, 10)] || 'Column') : '';
    const valName = headers[parseInt(valField.value, 10)] || 'Value';

    let html = '<thead><tr><th>' + escapeHtml(rowName) +
      (colName ? ' \\ ' + escapeHtml(colName) : '') + '</th>';
    p.colLabels.forEach(cl => { html += '<th>' + escapeHtml(cl || valName) + '</th>'; });
    html += '<th>Total</th></tr></thead><tbody>';

    p.rowLabels.forEach((rl, i) => {
      html += '<tr><td>' + escapeHtml(rl) + '</td>';
      p.matrix[i].forEach(v => { html += '<td>' + formatNum(v) + '</td>'; });
      html += '<td class="total-col">' + formatNum(p.rowTotals[i]) + '</td></tr>';
    });

    html += '<tr class="total-row"><td>Total</td>';
    p.colTotals.forEach(v => { html += '<td>' + formatNum(v) + '</td>'; });
    html += '<td>' + formatNum(p.grand) + '</td></tr></tbody>';

    pivotTable.innerHTML = html;
    pivotMeta.textContent = p.rowLabels.length + ' × ' + p.colLabels.length +
      ' · ' + p.agg + '(' + valName + ')';
    resultPanel.classList.remove('hidden');
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ---------- CSV export of the pivot ----------
  function csvEscape(v) {
    const s = String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function exportCSV() {
    if (!lastPivot) return;
    const p = lastPivot;
    const lines = [];
    const head = [''].concat(p.colLabels.map(c => c || '')).concat(['Total']);
    lines.push(head.map(csvEscape).join(','));
    p.rowLabels.forEach((rl, i) => {
      lines.push([rl].concat(p.matrix[i]).concat([p.rowTotals[i]]).map(csvEscape).join(','));
    });
    lines.push(['Total'].concat(p.colTotals).concat([p.grand]).map(csvEscape).join(','));
    const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'pivot-export.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 100);
  }

  // ---------- Events ----------
  sampleBtn.addEventListener('click', () => {
    csvInput.value = SAMPLE;
    clearError();
  });

  parseBtn.addEventListener('click', () => {
    clearError();
    const text = csvInput.value.trim();
    if (!text) { showError('Paste some CSV data first (first row = headers).'); return; }
    const data = parseCSV(text);
    if (data.length < 2) { showError('Need at least a header row and one data row.'); return; }
    const width = data[0].length;
    // Drop ragged rows that don't match the header width.
    const clean = data.filter(r => r.length === width);
    if (!clean.length || clean.length < 2) {
      showError('Rows have inconsistent column counts — check the CSV.');
      return;
    }
    headers = clean[0].map(h => h.trim());
    rows = clean.slice(1);
    rowCountEl.textContent = rows.length + ' rows · ' + headers.length + ' cols';
    fillSelects();
    configPanel.classList.remove('hidden');
    resultPanel.classList.add('hidden');
    exportBtn.disabled = true;
    lastPivot = null;
    // Persist the last CSV for convenience (on-device only).
    try { chrome.storage.local.set({ lastCsv: text }); } catch (e) { /* storage optional */ }
  });

  buildBtn.addEventListener('click', buildPivot);
  exportBtn.addEventListener('click', exportCSV);

  // Restore last CSV on open for convenience.
  try {
    chrome.storage.local.get('lastCsv', res => {
      if (res && res.lastCsv) csvInput.value = res.lastCsv;
    });
  } catch (e) { /* ignore */ }
})();
