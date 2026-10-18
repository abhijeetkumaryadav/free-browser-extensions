/* Table Flattener — popup logic.
 * ENGINE functions (between ENGINE-START / ENGINE-END) are pure and
 * headless-testable: they never touch the DOM or chrome.* APIs. */

'use strict';

// ---------------------------------------------------------------- ENGINE-START
// Candidate delimiters, in detection priority order.
const CANDIDATES = [',', '\t', ';', '|'];

/**
 * Split one line on a delimiter, honoring double-quoted fields
 * (RFC-4180 style: "" inside quotes = literal quote).
 */
function splitLine(line, delim) {
  const cells = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } // escaped quote
        else { inQuotes = false; }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delim) {
      cells.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells;
}

/**
 * Detect the delimiter used in `text`.
 * Scores each candidate by: lines that split into >1 cell, weighted by
 * consistency (variance penalty). Returns the best candidate, default ','.
 */
function detectDelimiter(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0).slice(0, 20);
  if (lines.length === 0) return ',';
  let best = ',';
  let bestScore = -1;
  for (const d of CANDIDATES) {
    const counts = lines.map(l => splitLine(l, d).length);
    const withSplit = counts.filter(c => c > 1).length;
    if (withSplit === 0) continue;
    // Consistency: penalize variance in column counts.
    const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
    const variance = counts.reduce((a, c) => a + (c - mean) * (c - mean), 0) / counts.length;
    const score = withSplit * 2 - variance - (d === ',' ? 0 : 0.5); // slight comma tie-break
    if (score > bestScore) { bestScore = score; best = d; }
  }
  return best;
}

/** Human label for a delimiter character. */
function delimLabel(d) {
  return { ',': 'comma (,)', '\t': 'tab', ';': 'semicolon (;)', '|': 'pipe (|)' }[d] || d;
}

/**
 * Parse raw text into rows of cells with the given delimiter.
 */
function parseRows(text, delim) {
  return text
    .split(/\r?\n/)
    .map(l => splitLine(l, delim));
}

/**
 * Flatten/normalize rows:
 *  - trim whitespace on every cell
 *  - drop fully-empty rows
 *  - pad short rows with '' so every row has the same column count
 * Returns { rows, cols }.
 */
function normalizeRows(rows) {
  const trimmed = rows
    .map(r => r.map(c => c.trim()))
    .filter(r => r.some(c => c.length > 0));
  const cols = trimmed.reduce((m, r) => Math.max(m, r.length), 0);
  const flat = trimmed.map(r => {
    while (r.length < cols) r.push('');
    return r;
  });
  return { rows: flat, cols };
}

/** Escape one CSV field. */
function csvField(cell) {
  if (/[",\n\r]/.test(cell)) return '"' + cell.replace(/"/g, '""') + '"';
  return cell;
}

/** Serialize normalized rows to a CSV string. */
function toCsv(rows) {
  return rows.map(r => r.map(csvField).join(',')).join('\r\n') + '\r\n';
}

/** Suggested download filename from a source name. */
function downloadName(sourceName) {
  const base = (sourceName || 'table').replace(/\.[a-z0-9]+$/i, '');
  const safe = base.replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '') || 'table';
  return safe + '-flattened.csv';
}
// ---------------------------------------------------------------- ENGINE-END

/* ---------------- UI wiring (DOM + storage only below this line) ---------------- */

const $ = id => document.getElementById(id);
const input = $('input'), fileInput = $('fileInput'), delimiterSel = $('delimiter');
const processBtn = $('processBtn'), clearBtn = $('clearBtn');
const resultCard = $('resultCard'), stats = $('stats'), delimNote = $('delimNote');
const previewTable = $('previewTable');
const downloadBtn = $('downloadBtn'), copyBtn = $('copyBtn');

let lastCsv = '';
let lastSourceName = 'table';

// Restore last session (input text only — files aren't persisted).
chrome.storage.local.get({ tf_input: '', tf_delim: 'auto' }, data => {
  input.value = data.tf_input || '';
  delimiterSel.value = data.tf_delim || 'auto';
});

function persistSession() {
  chrome.storage.local.set({ tf_input: input.value, tf_delim: delimiterSel.value });
}

input.addEventListener('input', persistSession);
delimiterSel.addEventListener('change', persistSession);

fileInput.addEventListener('change', () => {
  const f = fileInput.files[0];
  if (!f) return;
  lastSourceName = f.name;
  const reader = new FileReader();
  reader.onload = () => {
    input.value = String(reader.result || '');
    persistSession();
    process();
  };
  reader.readAsText(f);
  fileInput.value = '';
});

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function process() {
  const text = input.value;
  if (!text.trim()) {
    resultCard.hidden = true;
    return;
  }
  let delim = delimiterSel.value;
  let auto = false;
  if (delim === 'auto') {
    delim = detectDelimiter(text);
    auto = true;
  }
  const { rows, cols } = normalizeRows(parseRows(text, delim));
  if (rows.length === 0) {
    resultCard.hidden = true;
    return;
  }
  lastCsv = toCsv(rows);

  // Preview: header = first row if it looks like a header (all non-numeric).
  const [head, ...rest] = rows;
  const headLooksHeader = head.every(c => c !== '' && isNaN(Number(c)));
  const headerRow = headLooksHeader ? head : head.map((_, i) => 'Col ' + (i + 1));
  const bodyRows = headLooksHeader ? rest : rows;

  let html = '<thead><tr>' + headerRow.map(c => '<th>' + escapeHtml(c) + '</th>').join('') + '</tr></thead><tbody>';
  const PREVIEW_LIMIT = 50;
  for (const r of bodyRows.slice(0, PREVIEW_LIMIT)) {
    html += '<tr>' + r.map(c => '<td>' + escapeHtml(c) + '</td>').join('') + '</tr>';
  }
  html += '</tbody>';
  previewTable.innerHTML = html;

  const shown = Math.min(bodyRows.length, PREVIEW_LIMIT);
  stats.textContent = rows.length + ' rows × ' + cols + ' cols' +
    (bodyRows.length > PREVIEW_LIMIT ? ' (showing ' + shown + ')' : '');
  delimNote.innerHTML = 'Delimiter: <b>' + escapeHtml(delimLabel(delim)) + '</b>' +
    (auto ? ' (auto-detected)' : ' (manual)');
  resultCard.hidden = false;
}

processBtn.addEventListener('click', process);

clearBtn.addEventListener('click', () => {
  input.value = '';
  resultCard.hidden = true;
  lastCsv = '';
  persistSession();
});

downloadBtn.addEventListener('click', () => {
  if (!lastCsv) return;
  const blob = new Blob([lastCsv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = downloadName(lastSourceName);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
});

copyBtn.addEventListener('click', async () => {
  if (!lastCsv) return;
  try {
    await navigator.clipboard.writeText(lastCsv);
    copyBtn.textContent = 'Copied!';
  } catch (e) {
    copyBtn.textContent = 'Copy failed';
  }
  setTimeout(() => { copyBtn.textContent = 'Copy CSV'; }, 1500);
});
