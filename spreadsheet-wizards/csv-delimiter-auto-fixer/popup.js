/* CSV Doctor — delimiter detection, RFC-4180 parsing, and clean re-export.
   All processing happens on-device; no network calls. */

'use strict';

const CANDIDATES = [
  { char: ',', label: 'Comma (,)' },
  { char: ';', label: 'Semicolon (;)' },
  { char: '\t', label: 'Tab' },
  { char: '|', label: 'Pipe (|)' },
];

const $ = (id) => document.getElementById(id);
const input = $('input'), preview = $('preview'), warningsBox = $('warnings');
const analysisPanel = $('analysisPanel'), emptyState = $('emptyState');

let currentRows = [];      // parsed rows with the active delimiter
let activeDelimiter = ','; // delimiter currently used for parsing
let detectedDelimiter = ','; // auto-detected delimiter

/* ---------- RFC-4180-ish CSV parser (handles quoted fields, escaped quotes) ---------- */
function parseCSV(text, delim) {
  const rows = [];
  let row = [], field = '', inQuotes = false, i = 0;
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; }
        else { inQuotes = false; i++; }
      } else { field += c; i++; }
    } else {
      if (c === '"') { inQuotes = true; i++; }
      else if (c === delim) { row.push(field); field = ''; i++; }
      else if (c === '\r') { i++; } // ignore CR, handle LF below
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; }
      else { field += c; i++; }
    }
  }
  // Flush trailing field/row
  row.push(field);
  // Drop a single trailing empty row produced by a final newline
  if (row.length === 1 && row[0] === '' && rows.length > 0) { /* skip */ }
  else rows.push(row);
  // Remove rows that are completely empty (blank lines)
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ''));
}

/* ---------- Delimiter detection via heuristic scoring ---------- */
// Score: reward consistent column counts across lines, penalize raggedness.
function detectDelimiter(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '').slice(0, 25);
  if (lines.length === 0) return { char: ',', confidence: 0 };

  let best = { char: ',', score: -Infinity, counts: [] };
  for (const cand of CANDIDATES) {
    const counts = lines.map((l) => parseCSV(l, cand.char)[0].length);
    const nonzero = counts.filter((n) => n > 1).length;
    if (nonzero === 0) continue; // delimiter never splits anything -> useless
    const mode = counts.slice().sort((a, b) =>
      counts.filter((v) => v === a).length - counts.filter((v) => v === b).length
    ).pop();
    const consistent = counts.filter((n) => n === mode).length;
    // Score: consistency ratio * average fields, minus ragged penalty
    const score = (consistent / counts.length) * mode - (counts.length - consistent) * 2;
    if (score > best.score) best = { char: cand.char, score, counts };
  }
  const confidence = best.score > 0 ? 'high' : 'low';
  return { char: best.char, confidence };
}

/* ---------- CSV serialization with proper quoting ---------- */
function escapeField(value, delim) {
  const needsQuote = value.includes(delim) || value.includes('"') ||
                     value.includes('\n') || value.includes('\r');
  if (!needsQuote) return value;
  return '"' + value.replace(/"/g, '""') + '"';
}

function toCSV(rows, delim) {
  return rows.map((r) => r.map((f) => escapeField(f, delim)).join(delim)).join('\r\n');
}

function delimDisplay(char) {
  const found = CANDIDATES.find((c) => c.char === char);
  return found ? found.char === '\t' ? 'TAB' : found.label.split(' ')[0] : JSON.stringify(char);
}

/* ---------- Rendering ---------- */
function render() {
  const text = input.value;
  if (!text.trim()) {
    analysisPanel.classList.add('hidden');
    emptyState.classList.remove('hidden');
    return;
  }
  analysisPanel.classList.remove('hidden');
  emptyState.classList.add('hidden');

  const detected = detectDelimiter(text);
  detectedDelimiter = detected.char;

  const override = $('override').value;
  activeDelimiter = override !== '' ? override : detectedDelimiter;

  const badge = $('detected');
  badge.textContent = delimDisplay(detectedDelimiter);
  $('detectNote').textContent = override !== ''
    ? `(overridden — auto said ${delimDisplay(detectedDelimiter)})`
    : detected.confidence === 'high' ? '✓ confident' : '⚠ low confidence — check override';

  currentRows = parseCSV(text, activeDelimiter);
  const colCount = currentRows.length ? currentRows[0].length : 0;

  $('statRows').textContent = currentRows.length;
  $('statCols').textContent = colCount;

  // Warnings: ragged rows
  const ragged = [];
  currentRows.forEach((r, idx) => {
    if (r.length !== colCount) ragged.push({ idx: idx + 1, cols: r.length });
  });
  $('statRagged').textContent = ragged.length;

  warningsBox.innerHTML = '';
  if (ragged.length) {
    warningsBox.classList.remove('hidden');
    const shown = ragged.slice(0, 5);
    shown.forEach((w) => {
      const div = document.createElement('div');
      div.className = 'warning-item';
      div.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
      const span = document.createElement('span');
      span.textContent = `Row ${w.idx}: ${w.cols} fields, expected ${colCount} — check for stray delimiters inside unquoted text.`;
      div.appendChild(span);
      warningsBox.appendChild(div);
    });
    if (ragged.length > 5) {
      const more = document.createElement('div');
      more.className = 'warning-item';
      const span = document.createElement('span');
      span.textContent = `…and ${ragged.length - 5} more ragged rows.`;
      more.appendChild(span);
      warningsBox.appendChild(more);
    }
  } else {
    warningsBox.classList.add('hidden');
  }

  // Preview (first 8 rows)
  preview.innerHTML = '';
  if (currentRows.length) {
    const thead = document.createElement('thead');
    const hr = document.createElement('tr');
    currentRows[0].forEach((_, ci) => {
      const th = document.createElement('th');
      th.textContent = `Col ${ci + 1}`;
      hr.appendChild(th);
    });
    thead.appendChild(hr);
    preview.appendChild(thead);

    const tbody = document.createElement('tbody');
    currentRows.slice(0, 8).forEach((r) => {
      const tr = document.createElement('tr');
      if (r.length !== colCount) tr.classList.add('ragged');
      r.forEach((cell) => {
        const td = document.createElement('td');
        td.textContent = cell;
        td.title = cell;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    preview.appendChild(tbody);
  }

  // Persist last-used output delimiter
  chrome.storage.local.set({ outDelim: $('outDelim').value });
}

/* ---------- Actions ---------- */
function buildCleanCSV() {
  return toCSV(currentRows, $('outDelim').value);
}

$('download').addEventListener('click', () => {
  const csv = buildCleanCSV();
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  chrome.downloads.download({ url, filename: 'cleaned.csv', saveAs: true }, () => {
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  });
});

$('copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(buildCleanCSV());
    const btn = $('copy');
    const original = btn.innerHTML;
    btn.innerHTML = 'Copied ✓';
    setTimeout(() => { btn.innerHTML = original; }, 1400);
  } catch { /* clipboard unavailable */ }
});

$('override').addEventListener('change', render);
$('outDelim').addEventListener('change', () => chrome.storage.local.set({ outDelim: $('outDelim').value }));

let debounce = null;
input.addEventListener('input', () => {
  clearTimeout(debounce);
  debounce = setTimeout(render, 250);
});

/* ---------- File loading ---------- */
$('browse').addEventListener('click', () => $('file').click());
$('file').addEventListener('change', (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = () => { input.value = reader.result; render(); };
  reader.readAsText(f);
  e.target.value = '';
});

['dragover', 'dragenter'].forEach((ev) => input.addEventListener(ev, (e) => {
  e.preventDefault(); input.classList.add('dragover');
}));
['dragleave', 'drop'].forEach((ev) => input.addEventListener(ev, (e) => {
  e.preventDefault(); input.classList.remove('dragover');
}));
input.addEventListener('drop', (e) => {
  const f = e.dataTransfer.files && e.dataTransfer.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = () => { input.value = reader.result; render(); };
  reader.readAsText(f);
});

$('sample').addEventListener('click', () => {
  input.value = [
    'name;city;score;note',
    'Ada Lovelace;London;95;"First programmer; visionary"',
    'Grace Hopper;Arlington;98;COBOL pioneer',
    'Alan Turing;London;99',
    '"Hopper, Grace";Boston;97;"Debugging; ""amazing"" work"',
  ].join('\n');
  render();
});

$('clear').addEventListener('click', () => {
  input.value = '';
  $('override').value = '';
  render();
});

/* ---------- Init ---------- */
chrome.storage.local.get({ outDelim: ',' }, (res) => {
  $('outDelim').value = res.outDelim;
});
render();
