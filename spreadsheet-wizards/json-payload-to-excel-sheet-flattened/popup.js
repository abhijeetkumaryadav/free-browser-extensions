/* FlatSheet — JSON flattener. All on-device, no network. */
(function () {
  'use strict';

  // ---------- DOM ----------
  const jsonInput = document.getElementById('json-input');
  const flattenBtn = document.getElementById('flatten-btn');
  const sampleBtn = document.getElementById('load-sample');
  const jsonError = document.getElementById('json-error');
  const jsonMeta = document.getElementById('json-meta');
  const resultPanel = document.getElementById('result-panel');
  const flatTable = document.getElementById('flat-table');
  const tableMeta = document.getElementById('table-meta');
  const downloadBtn = document.getElementById('download-btn');
  const copyBtn = document.getElementById('copy-btn');
  const optArrays = document.getElementById('opt-arrays');
  const optNulls = document.getElementById('opt-nulls');

  // ---------- State ----------
  let columns = []; // string[]
  let dataRows = []; // string[][]

  const SAMPLE = JSON.stringify([
    { id: 1, name: 'Ava', address: { city: 'Mumbai', pin: '400001' }, tags: ['vip', 'new'], active: true },
    { id: 2, name: 'Raj', address: { city: 'Delhi' }, tags: ['returning'], active: false, score: null },
    { id: 3, name: 'Mia', address: { city: 'Bengaluru', pin: '560001' }, tags: [], meta: { source: 'web', campaign: { id: 'D24' } } }
  ], null, 2);

  // ---------- Flattening ----------
  // Flattens a value into { dottedKey: scalar }. Arrays expand by index
  // when expandArrays is true, otherwise join as a JSON string.
  function flatten(value, prefix, out, expandArrays) {
    if (value === null || value === undefined) {
      out[prefix] = null;
      return;
    }
    if (Array.isArray(value)) {
      if (expandArrays && value.length && value.some(v => v !== null && typeof v === 'object')) {
        value.forEach((v, i) => flatten(v, prefix ? prefix + '.' + i : String(i), out, expandArrays));
      } else if (expandArrays && value.length) {
        value.forEach((v, i) => { out[prefix ? prefix + '.' + i : String(i)] = v; });
      } else {
        out[prefix] = value.length ? JSON.stringify(value) : '';
      }
      return;
    }
    if (typeof value === 'object') {
      const keys = Object.keys(value);
      if (!keys.length) { out[prefix] = ''; return; }
      keys.forEach(k => {
        const np = prefix ? prefix + '.' + k : k;
        flatten(value[k], np, out, expandArrays);
      });
      return;
    }
    out[prefix] = value;
  }

  function scalarToCell(v, keepNulls) {
    if (v === null || v === undefined) return keepNulls ? 'null' : '';
    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  }

  function doFlatten() {
    clearError();
    const text = jsonInput.value.trim();
    if (!text) { showError('Paste some JSON first.'); return; }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      showError('Invalid JSON: ' + e.message);
      return;
    }

    // Normalize to an array of records. A bare object becomes one row;
    // a bare scalar/array-of-scalars becomes a single-column table.
    let records;
    if (Array.isArray(parsed)) records = parsed;
    else records = [parsed];

    const expandArrays = optArrays.checked;
    const keepNulls = optNulls.checked;

    const flatRecords = records.map(rec => {
      const out = {};
      if (rec !== null && typeof rec === 'object') flatten(rec, '', out, expandArrays);
      else out['value'] = rec;
      delete out['']; // safety: never keep an empty key
      return out;
    });

    // Union of columns, first-seen order.
    const colOrder = [], seen = new Set();
    flatRecords.forEach(fr => Object.keys(fr).forEach(k => {
      if (!seen.has(k)) { seen.add(k); colOrder.push(k); }
    }));

    columns = colOrder;
    dataRows = flatRecords.map(fr =>
      colOrder.map(c => scalarToCell(Object.prototype.hasOwnProperty.call(fr, c) ? fr[c] : undefined, keepNulls))
    );

    jsonMeta.textContent = records.length + ' record' + (records.length === 1 ? '' : 's');
    tableMeta.textContent = dataRows.length + ' rows × ' + columns.length + ' cols';
    renderTable();
    resultPanel.classList.remove('hidden');

    // Persist last JSON for convenience (on-device only).
    try { chrome.storage.local.set({ lastJson: text }); } catch (e) { /* optional */ }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function renderTable() {
    let html = '<thead><tr>';
    columns.forEach(c => { html += '<th>' + escapeHtml(c) + '</th>'; });
    html += '</tr></thead><tbody>';
    const MAX_PREVIEW = 200;
    dataRows.slice(0, MAX_PREVIEW).forEach(r => {
      html += '<tr>';
      r.forEach(cell => { html += '<td title="' + escapeHtml(cell) + '">' + escapeHtml(cell) + '</td>'; });
      html += '</tr>';
    });
    html += '</tbody>';
    flatTable.innerHTML = html;
    if (dataRows.length > MAX_PREVIEW) {
      tableMeta.textContent += ' · previewing first ' + MAX_PREVIEW;
    }
  }

  // ---------- Export ----------
  function csvEscape(v) {
    const s = String(v);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function buildCSV() {
    const lines = [columns.map(csvEscape).join(',')];
    dataRows.forEach(r => lines.push(r.map(csvEscape).join(',')));
    // BOM makes Excel open UTF-8 correctly.
    return '\uFEFF' + lines.join('\r\n');
  }

  function downloadCSV() {
    const blob = new Blob([buildCSV()], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'flattened.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 100);
  }

  function copyTSV() {
    const lines = [columns.join('\t')];
    dataRows.forEach(r => lines.push(r.map(c => String(c).replace(/\t/g, ' ')).join('\t')));
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      const old = copyBtn.innerHTML;
      copyBtn.innerHTML = 'Copied!';
      setTimeout(() => { copyBtn.innerHTML = old; }, 1200);
    });
  }

  // ---------- Helpers ----------
  function showError(msg) {
    jsonError.textContent = msg;
    jsonError.classList.remove('hidden');
  }
  function clearError() { jsonError.classList.add('hidden'); jsonError.textContent = ''; }

  // ---------- Events ----------
  sampleBtn.addEventListener('click', () => { jsonInput.value = SAMPLE; clearError(); });
  flattenBtn.addEventListener('click', doFlatten);
  optArrays.addEventListener('change', () => { if (columns.length) doFlatten(); });
  optNulls.addEventListener('change', () => { if (columns.length) doFlatten(); });
  downloadBtn.addEventListener('click', downloadCSV);
  copyBtn.addEventListener('click', copyTSV);

  // Restore last JSON on open for convenience.
  try {
    chrome.storage.local.get('lastJson', res => {
      if (res && res.lastJson) jsonInput.value = res.lastJson;
    });
  } catch (e) { /* ignore */ }
})();
