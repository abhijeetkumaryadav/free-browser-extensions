/* RegexFind — Regex find & replace for pasted CSV/TSV data.
 * All parsing and regex work happens locally in the popup. No network, no servers. */
'use strict';

/* ---------- DOM ---------- */
const $ = (id) => document.getElementById(id);
const csvInput = $('csvInput'), hasHeader = $('hasHeader'), delimNote = $('delimNote');
const tableStat = $('tableStat'), loadSample = $('loadSample'), clearData = $('clearData');
const regexInput = $('regexInput'), replaceInput = $('replaceInput');
const flagG = $('flagG'), flagI = $('flagI'), flagM = $('flagM');
const regexStatus = $('regexStatus'), scopeSelect = $('scopeSelect');
const matchCount = $('matchCount'), cellCount = $('cellCount');
const previewTable = $('previewTable'), emptyNote = $('emptyNote');
const viewBefore = $('viewBefore'), viewAfter = $('viewAfter');
const applyBtn = $('applyBtn'), downloadBtn = $('downloadBtn'), copyBtn = $('copyBtn');

/* ---------- State ---------- */
let table = [];        // array of rows, each row = array of strings
let delimiter = ',';   // detected delimiter
let viewMode = 'before'; // 'before' | 'after'
let compiled = null;   // compiled RegExp or null
let compileError = null;
let appliedSnapshot = null; // last applied table (for download)

/* ---------- CSV parsing ---------- */
/** Split text into rows/cols honoring quotes. Delimiter auto-detected. */
function parseTable(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (!lines.length) return { rows: [], delimiter: ',' };

  // Detect delimiter: score candidates by consistency of field counts.
  const candidates = [',', '\t', ';', '|'];
  let best = ',', bestScore = -1;
  for (const d of candidates) {
    const counts = lines.slice(0, 8).map((l) => splitLine(l, d).length);
    const unique = new Set(counts).size;
    const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
    const score = unique === 1 ? avg * 10 : avg - unique; // consistent columns win big
    if (score > bestScore) { bestScore = score; best = d; }
  }
  const rows = lines.map((l) => splitLine(l, best));
  return { rows, delimiter: best };
}

/** Split one line on delimiter, honoring double-quoted fields with "" escapes. */
function splitLine(line, d) {
  const out = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = false;
      } else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === d) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

/** Serialize rows back to CSV with proper quoting. */
function toCSV(rows) {
  return rows.map((row) => row.map((cell) => {
    const s = String(cell ?? '');
    return (/[",\n]/.test(s)) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }).join(',')).join('\n');
}

/** Escape HTML for safe rendering of cell text. */
function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ---------- Regex compilation ---------- */
function flags() {
  return (flagG.checked ? 'g' : '') + (flagI.checked ? 'i' : '') + (flagM.checked ? 'm' : '');
}

function compileRegex() {
  const src = regexInput.value;
  if (!src) {
    compiled = null; compileError = null;
    regexStatus.textContent = 'Enter a pattern';
    regexStatus.className = 'regex-status idle';
    return;
  }
  try {
    // Force global flag so all occurrences are counted even if user unchecked g.
    const f = flags().includes('g') ? flags() : flags() + 'g';
    compiled = new RegExp(src, f);
    compileError = null;
    regexStatus.textContent = '✓ Valid pattern';
    regexStatus.className = 'regex-status ok';
  } catch (e) {
    compiled = null; compileError = e;
    regexStatus.textContent = '✗ ' + e.message;
    regexStatus.className = 'regex-status err';
  }
  // Persist pattern + flags for convenience.
  chrome.storage.local.set({ rx_pattern: src, rx_flags: flags(), rx_replace: replaceInput.value }).catch(() => {});
}

/* ---------- Scope ---------- */
function rebuildScope() {
  const prev = scopeSelect.value;
  scopeSelect.innerHTML = '';
  const opt = document.createElement('option');
  opt.value = 'all'; opt.textContent = 'Whole table';
  scopeSelect.appendChild(opt);
  if (!table.length) return;
  const headers = hasHeader.checked ? table[0] : null;
  const colCount = Math.max(...table.map((r) => r.length));
  for (let c = 0; c < colCount; c++) {
    const o = document.createElement('option');
    o.value = String(c);
    o.textContent = headers && headers[c] ? `Column: ${headers[c]}` : `Column ${c + 1}`;
    scopeSelect.appendChild(o);
  }
  if ([...scopeSelect.options].some((o) => o.value === prev)) scopeSelect.value = prev;
}

function inScope(colIdx) {
  return scopeSelect.value === 'all' || Number(scopeSelect.value) === colIdx;
}

/* ---------- Preview ---------- */
function dataRows() {
  // Rows excluding header (if header enabled and table has data rows).
  return (hasHeader.checked && table.length > 1) ? table.slice(1) : table;
}

/** Compute matches per cell: { row, col, html, replaced, changed, count }. */
function analyze() {
  const rows = table;
  const cells = [];
  let totalMatches = 0;
  const affected = new Set();
  rows.forEach((row, r) => {
    row.forEach((cell, c) => {
      const isHeaderRow = hasHeader.checked && r === 0;
      if (isHeaderRow || !inScope(c) || !compiled) {
        cells.push({ r, c, html: esc(cell), changed: false, count: 0 });
        return;
      }
      const s = String(cell ?? '');
      compiled.lastIndex = 0;
      let m, count = 0;
      const parts = [];
      let last = 0;
      // Walk matches to build highlighted HTML.
      compiled.lastIndex = 0;
      while ((m = compiled.exec(s)) !== null) {
        count++;
        parts.push(esc(s.slice(last, m.index)));
        parts.push('<mark>' + esc(m[0]) + '</mark>');
        last = m.index + m[0].length;
        if (m[0].length === 0) compiled.lastIndex++; // avoid infinite loop on zero-width
      }
      parts.push(esc(s.slice(last)));
      totalMatches += count;
      // Replacement (capture groups supported natively by String.replace).
      compiled.lastIndex = 0;
      const replaced = s.replace(compiled, replaceInput.value);
      const changed = replaced !== s;
      if (count > 0) affected.add(r + ':' + c);
      cells.push({ r, c, html: parts.join(''), replaced: esc(replaced), changed, count });
    });
  });
  return { cells, totalMatches, affectedCount: affected.size };
}

function render() {
  const hasData = table.length > 0;
  emptyNote.style.display = hasData ? 'none' : 'block';
  previewTable.style.display = hasData ? 'table' : 'none';

  if (!hasData) {
    tableStat.textContent = '0 rows × 0 cols';
    matchCount.textContent = '0'; cellCount.textContent = '0';
    applyBtn.disabled = true; downloadBtn.disabled = true; copyBtn.disabled = true;
    return;
  }

  const colCount = Math.max(...table.map((r) => r.length));
  tableStat.textContent = `${table.length} rows × ${colCount} cols`;
  delimNote.innerHTML = 'delim: <b>' + (delimiter === '\t' ? 'tab' : esc(delimiter)) + '</b>';

  const { cells, totalMatches, affectedCount } = analyze();
  matchCount.textContent = String(totalMatches);
  cellCount.textContent = String(affectedCount);

  const byRow = new Map();
  cells.forEach((cell) => {
    if (!byRow.has(cell.r)) byRow.set(cell.r, []);
    byRow.get(cell.r).push(cell);
  });

  let html = '';
  const headerRow = hasHeader.checked && table.length > 0;
  table.forEach((row, r) => {
    html += '<tr>';
    const rowCells = byRow.get(r) || [];
    for (let c = 0; c < colCount; c++) {
      const cell = rowCells.find((x) => x.c === c);
      const tag = (headerRow && r === 0) ? 'th' : 'td';
      if (!cell) { html += `<${tag}></${tag}>`; continue; }
      if (tag === 'th') { html += `<th>${esc(table[0][c] ?? '')}</th>`; continue; }
      if (viewMode === 'after') {
        const cls = cell.changed ? ' class="changed"' : '';
        html += `<td${cls}>${cell.replaced ?? cell.html}</td>`;
      } else {
        const cls = cell.count > 0 ? ' class="affected-dot"' : '';
        html += `<td${cls}>${cell.html}</td>`;
      }
    }
    html += '</tr>';
  });
  previewTable.innerHTML = html;

  const canAct = hasData && compiled && !compileError;
  applyBtn.disabled = !canAct;
  downloadBtn.disabled = !canAct;
  copyBtn.disabled = !canAct;
}

function refresh() {
  const { rows, delimiter: d } = parseTable(csvInput.value);
  table = rows;
  delimiter = d;
  compileRegex();
  rebuildScope();
  render();
}

/* ---------- Actions ---------- */
function applyToData() {
  if (!compiled) return;
  const { cells } = analyze();
  const lookup = new Map(cells.map((cell) => [cell.r + ':' + cell.c, cell]));
  const newRows = table.map((row, r) =>
    row.map((cell, c) => {
      const key = r + ':' + c;
      const info = lookup.get(key);
      if (!info || !info.changed) return cell;
      compiled.lastIndex = 0;
      return String(cell ?? '').replace(compiled, replaceInput.value);
    })
  );
  csvInput.value = toCSV(newRows);
  appliedSnapshot = newRows;
  refresh();
}

function currentCSV() {
  return toCSV(appliedSnapshot || table);
}

function downloadCSV() {
  const blob = new Blob([currentCSV()], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'regexfind-output.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function copyCSV() {
  try {
    await navigator.clipboard.writeText(currentCSV());
    copyBtn.textContent = 'Copied!';
    setTimeout(() => (copyBtn.textContent = 'Copy'), 1200);
  } catch {
    copyBtn.textContent = 'Copy failed';
    setTimeout(() => (copyBtn.textContent = 'Copy'), 1200);
  }
}

/* ---------- Events ---------- */
let debounce = null;
function scheduleRefresh() {
  clearTimeout(debounce);
  debounce = setTimeout(refresh, 250);
}

csvInput.addEventListener('input', scheduleRefresh);
regexInput.addEventListener('input', scheduleRefresh);
replaceInput.addEventListener('input', scheduleRefresh);
[flagG, flagI, flagM].forEach((f) => f.addEventListener('change', scheduleRefresh));
hasHeader.addEventListener('change', scheduleRefresh);
scopeSelect.addEventListener('change', render);

viewBefore.addEventListener('click', () => { viewMode = 'before'; viewBefore.classList.add('active'); viewAfter.classList.remove('active'); render(); });
viewAfter.addEventListener('click', () => { viewMode = 'after'; viewAfter.classList.add('active'); viewBefore.classList.remove('active'); render(); });

applyBtn.addEventListener('click', applyToData);
downloadBtn.addEventListener('click', downloadCSV);
copyBtn.addEventListener('click', copyCSV);

loadSample.addEventListener('click', () => {
  csvInput.value = [
    'name,phone,joined',
    'Jane Doe,(555) 123-4567,2024-01-15',
    'John Smith,555.987.6543,15/02/2024',
    'Ana Ruiz,+1 555 222 3344,2024/03/20',
    'Bob Lee,5551238899,Apr 5, 2024'
  ].join('\n');
  regexInput.value = '[\\s.()-]';
  replaceInput.value = '';
  refresh();
});
clearData.addEventListener('click', () => { csvInput.value = ''; refresh(); });

/* ---------- Init: restore saved pattern ---------- */
(async function init() {
  try {
    const saved = await chrome.storage.local.get(['rx_pattern', 'rx_flags', 'rx_replace']);
    if (saved.rx_pattern) regexInput.value = saved.rx_pattern;
    if (saved.rx_replace) replaceInput.value = saved.rx_replace;
    if (saved.rx_flags) {
      flagG.checked = saved.rx_flags.includes('g');
      flagI.checked = saved.rx_flags.includes('i');
      flagM.checked = saved.rx_flags.includes('m');
    }
  } catch { /* storage unavailable — non-fatal */ }
  refresh();
})();
