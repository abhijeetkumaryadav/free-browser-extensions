'use strict';
/**
 * CsvJson — parse CSV (quoted fields, custom delimiter, auto-detect)
 * and convert it to JSON (array of objects or array of arrays).
 * All processing happens locally; nothing is sent anywhere.
 */

// ---------- DOM ----------
const $ = (id) => document.getElementById(id);
const els = {
  csvInput: $('csvInput'), jsonOutput: $('jsonOutput'),
  delimiter: $('delimiter'), outputMode: $('outputMode'),
  firstRowHeader: $('firstRowHeader'), pretty: $('pretty'),
  convert: $('convert'), previewBtn: $('previewBtn'),
  errors: $('errors'), previewWrap: $('previewWrap'), previewTable: $('previewTable'),
  statRows: $('statRows'), statCols: $('statCols'), statDelim: $('statDelim'),
  copy: $('copy'), download: $('download'), clear: $('clear'),
};

// ---------- CSV parsing (pure) ----------
const DELIMS = { ',': 'comma', ';': 'semicolon', '\t': 'tab', '|': 'pipe' };

/**
 * Parse one CSV text with a given delimiter.
 * Handles: quoted fields, escaped quotes (""), embedded newlines in quotes.
 * Returns { rows: string[][], errors: string[] }.
 */
function parseCSV(text, delim) {
  const rows = [];
  const errors = [];
  let row = [], field = '', inQuotes = false, lineNum = 1;

  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (c === '\n') lineNum += 1;
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; } // escaped quote
        else { inQuotes = false; }
      } else {
        field += c;
      }
    } else if (c === '"') {
      // a quote only opens a quoted field at the start of a field
      if (field === '') inQuotes = true;
      else field += c;
    } else if (c === delim) {
      row.push(field); field = '';
    } else if (c === '\r') {
      // ignore CR; \n handles line ends
    } else if (c === '\n') {
      row.push(field); rows.push(row); row = []; field = '';
    } else {
      field += c;
    }
  }
  if (inQuotes) errors.push('Unterminated quoted field — check for a missing closing quote.');
  row.push(field);
  rows.push(row);

  // drop the trailing empty row when input ends with a newline
  if (rows.length && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === '') {
    rows.pop();
  }
  return { rows, errors };
}

/** Pick the delimiter whose first few rows have the most consistent column count. */
function detectDelimiter(text) {
  const candidates = [',', ';', '\t', '|'];
  let best = ',', bestScore = -1;
  for (const d of candidates) {
    const { rows } = parseCSV(text.slice(0, 2000), d);
    if (!rows.length) continue;
    const counts = rows.map((r) => r.length);
    const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
    const consistent = counts.every((c) => c === counts[0]);
    const score = avg * 2 + (consistent ? 3 : 0) + (avg > 1 ? 2 : 0);
    if (score > bestScore) { bestScore = score; best = d; }
  }
  return best;
}

/**
 * Convert parsed rows to JSON.
 * mode 'objects': array of objects, header row (or generated col_0… keys) as keys.
 * mode 'arrays':  raw array of arrays.
 * Returns { json, rows, cols, errors }.
 */
function rowsToJSON(rows, opts) {
  const errors = [];
  if (!rows.length) return { json: '[]', rows: 0, cols: 0, errors };

  let dataRows = rows;
  let header;
  if (opts.firstRowHeader) {
    header = rows[0];
    dataRows = rows.slice(1);
  } else {
    const cols = Math.max(...rows.map((r) => r.length));
    header = Array.from({ length: cols }, (_, i) => `col_${i}`);
  }

  // duplicate header names get suffixed so no data is silently lost
  const seen = Object.create(null);
  const keys = header.map((h, i) => {
    let base = (h || '').trim() || `col_${i}`;
    if (seen[base] === undefined) { seen[base] = 0; return base; }
    seen[base] += 1;
    return `${base}_${seen[base]}`;
  });

  const colCount = Math.max(...rows.map((r) => r.length));
  dataRows.forEach((r, i) => {
    if (r.length !== colCount) {
      errors.push(`Row ${opts.firstRowHeader ? i + 2 : i + 1} has ${r.length} field(s), expected ${colCount}.`);
    }
  });

  let value;
  if (opts.mode === 'objects') {
    value = dataRows.map((r) => {
      const obj = {};
      keys.forEach((k, i) => { obj[k] = r[i] !== undefined ? r[i] : ''; });
      return obj;
    });
  } else {
    value = dataRows;
  }
  const json = opts.pretty ? JSON.stringify(value, null, 2) : JSON.stringify(value);
  return { json, rows: dataRows.length, cols: colCount, errors };
}

// ---------- UI ----------
function readOpts() {
  return {
    delimiter: els.delimiter.value,
    mode: els.outputMode.value,
    firstRowHeader: els.firstRowHeader.checked,
    pretty: els.pretty.checked,
  };
}

function delimLabel(d) {
  return d === '\t' ? 'tab' : d === ',' ? ',' : d === ';' ? ';' : '|';
}

function showErrors(list) {
  els.errors.innerHTML = '';
  if (!list.length) { els.errors.hidden = true; return; }
  els.errors.hidden = false;
  list.forEach((msg) => {
    const div = document.createElement('div');
    div.textContent = '⚠ ' + msg;
    els.errors.appendChild(div);
  });
}

function renderPreview(rows, header) {
  els.previewTable.innerHTML = '';
  const thead = document.createElement('thead');
  const tr = document.createElement('tr');
  header.forEach((h) => {
    const th = document.createElement('th');
    th.textContent = h;
    tr.appendChild(th);
  });
  thead.appendChild(tr);
  els.previewTable.appendChild(thead);
  const tbody = document.createElement('tbody');
  rows.slice(0, 10).forEach((r) => {
    const trb = document.createElement('tr');
    r.forEach((cell) => {
      const td = document.createElement('td');
      td.textContent = cell;
      trb.appendChild(td);
    });
    tbody.appendChild(trb);
  });
  els.previewTable.appendChild(tbody);
  els.previewWrap.hidden = false;
}

function doConvert(showTable) {
  const text = els.csvInput.value;
  if (!text.trim()) {
    showErrors(['Paste some CSV first.']);
    return;
  }
  const opts = readOpts();
  const delim = opts.delimiter === 'auto' ? detectDelimiter(text) : (opts.delimiter === 'tab' ? '\t' : opts.delimiter);
  const { rows, errors: parseErrors } = parseCSV(text, delim);
  const { json, rows: nRows, cols: nCols, errors: shapeErrors } = rowsToJSON(rows, opts);

  els.jsonOutput.value = json;
  els.statRows.textContent = nRows;
  els.statCols.textContent = nCols;
  els.statDelim.textContent = delimLabel(delim);
  showErrors([...parseErrors, ...shapeErrors]);

  if (showTable && rows.length) {
    const header = opts.firstRowHeader ? rows[0] : Array.from({ length: nCols }, (_, i) => `col_${i}`);
    renderPreview(opts.firstRowHeader ? rows.slice(1) : rows, header);
  }
  saveState();
}

els.convert.addEventListener('click', () => doConvert(false));
els.previewBtn.addEventListener('click', () => doConvert(true));
[els.delimiter, els.outputMode, els.firstRowHeader, els.pretty].forEach((el) => {
  el.addEventListener('change', () => { if (els.csvInput.value.trim()) doConvert(false); });
});

let debounce = null;
els.csvInput.addEventListener('input', () => {
  clearTimeout(debounce);
  debounce = setTimeout(() => { if (els.csvInput.value.trim()) doConvert(false); }, 400);
});

els.copy.addEventListener('click', async () => {
  if (!els.jsonOutput.value) return;
  try {
    await navigator.clipboard.writeText(els.jsonOutput.value);
    flash(els.copy, 'Copied ✓');
  } catch (e) {
    els.jsonOutput.select();
    document.execCommand('copy');
    flash(els.copy, 'Copied ✓');
  }
});

els.download.addEventListener('click', () => {
  if (!els.jsonOutput.value) return;
  const blob = new Blob([els.jsonOutput.value], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'converted.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

els.clear.addEventListener('click', () => {
  els.csvInput.value = '';
  els.jsonOutput.value = '';
  els.errors.hidden = true;
  els.previewWrap.hidden = true;
  els.statRows.textContent = '0';
  els.statCols.textContent = '0';
  els.statDelim.textContent = '–';
  saveState();
});

function flash(btn, text) {
  const orig = btn.textContent;
  btn.textContent = text;
  setTimeout(() => { btn.textContent = orig; }, 1200);
}

// ---------- persisted state ----------
const STORE_KEY = 'csvjson-state';
function saveState() {
  chrome.storage.local.set({
    [STORE_KEY]: {
      csv: els.csvInput.value,
      json: els.jsonOutput.value,
      opts: readOpts(),
    },
  });
}
function restoreState() {
  chrome.storage.local.get(STORE_KEY, (res) => {
    const s = res[STORE_KEY];
    if (!s) return;
    els.csvInput.value = s.csv || '';
    els.jsonOutput.value = s.json || '';
    if (s.opts) {
      els.delimiter.value = s.opts.delimiter || 'auto';
      els.outputMode.value = s.opts.mode || 'objects';
      els.firstRowHeader.checked = s.opts.firstRowHeader !== false;
      els.pretty.checked = s.opts.pretty !== false;
    }
  });
}

restoreState();
