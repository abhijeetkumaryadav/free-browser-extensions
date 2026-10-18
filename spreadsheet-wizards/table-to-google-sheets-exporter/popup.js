/* SheetsReady — table acquisition (page scan / paste), cleaning, and
   Sheets-ready export. All on-device; no Google API, no network calls. */

'use strict';

const $ = (id) => document.getElementById(id);
let current = null; // { label, rows } currently in the workbench

/* ---------- Tabs ---------- */
document.querySelectorAll('.tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-page').forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    $('tab-' + btn.dataset.tab).classList.add('active');
  });
});

/* ---------- Page table scan ---------- */
$('scan').addEventListener('click', async () => {
  const list = $('tableList');
  list.classList.remove('hidden');
  list.innerHTML = '<p class="footnote">Scanning…</p>';
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) throw new Error('no-tab');
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['scanner.js'],
    });
    const tables = (results && results[0] && results[0].result) || [];
    renderTableList(tables);
  } catch (e) {
    // Covers chrome:// pages, Web Store, and other restricted origins
    list.innerHTML = '<p class="footnote">Cannot scan this page (browser pages like ' +
      'chrome:// and the Web Store are off-limits to extensions). ' +
      'Use the "Paste table" tab instead.</p>';
  }
});

function renderTableList(tables) {
  const list = $('tableList');
  list.innerHTML = '';
  if (!tables.length) {
    list.innerHTML = '<p class="footnote">No tables found on this page. ' +
      'Try the "Paste table" tab.</p>';
    return;
  }
  tables.forEach((t) => {
    const card = document.createElement('div');
    card.className = 'table-card';
    const label = document.createElement('div');
    label.className = 't-label';
    label.textContent = t.label;
    const meta = document.createElement('div');
    meta.className = 't-meta';
    const cols = t.rows.length ? t.rows[0].length : 0;
    meta.textContent = `${t.rows.length} rows × ${cols} columns — click to select`;
    card.appendChild(label);
    card.appendChild(meta);
    card.addEventListener('click', () => {
      list.querySelectorAll('.table-card').forEach((c) => c.classList.remove('selected'));
      card.classList.add('selected');
      selectTable(t);
    });
    list.appendChild(card);
  });
}

/* ---------- Paste parsing ---------- */
function parseMarkdownTable(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.startsWith('|'));
  if (lines.length < 2) return null;
  // Second line must be a separator row like |---|---|
  if (!/^\|?[\s:\-|]+\|?$/.test(lines[1]) || !lines[1].includes('-')) return null;
  const splitRow = (l) => {
    let s = l.trim();
    if (s.startsWith('|')) s = s.slice(1);
    if (s.endsWith('|')) s = s.slice(0, -1);
    return s.split('|').map((c) => c.trim());
  };
  const rows = [splitRow(lines[0])];
  for (let i = 2; i < lines.length; i++) rows.push(splitRow(lines[i]));
  return rows;
}

function parseDelimited(text, delim) {
  const rows = [];
  let row = [], field = '', inQ = false, i = 0;
  while (i < text.length) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; } else { inQ = false; i++; }
      } else { field += c; i++; }
    } else if (c === '"') { inQ = true; i++; }
    else if (c === delim) { row.push(field); field = ''; i++; }
    else if (c === '\r') { i++; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; }
    else { field += c; i++; }
  }
  row.push(field);
  if (!(row.length === 1 && row[0] === '' && rows.length)) rows.push(row);
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ''));
}

function parsePasted(text) {
  const md = parseMarkdownTable(text);
  if (md) return { rows: md, kind: 'Markdown' };
  // Fallback: guess delimiter by counting candidates on the first lines
  const sample = text.split(/\r?\n/).filter((l) => l.trim()).slice(0, 5).join('\n');
  const counts = { ',': 0, '\t': 0, ';': 0 };
  for (const d of Object.keys(counts)) {
    counts[d] = (sample.split(d).length - 1);
  }
  const delim = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  const rows = parseDelimited(text, delim);
  if (rows.length < 2 || rows[0].length < 2) return null;
  return { rows, kind: delim === '\t' ? 'TSV' : delim === ';' ? 'semicolon CSV' : 'CSV' };
}

$('parsePaste').addEventListener('click', () => {
  const text = $('pasteInput').value;
  if (!text.trim()) return;
  const parsed = parsePasted(text);
  if (!parsed) {
    $('pasteInput').style.borderColor = '#f59e0b';
    setTimeout(() => { $('pasteInput').style.borderColor = ''; }, 1600);
    return;
  }
  selectTable({ label: `Pasted ${parsed.kind} table`, rows: parsed.rows });
});

/* ---------- Cleaning ---------- */
function cleanRows(rows) {
  let out = rows.map((r) => r.slice());
  if ($('optTrim').checked) out = out.map((r) => r.map((c) => c.trim()));
  if ($('optDropEmpty').checked) out = out.filter((r) => r.some((c) => c !== ''));
  return out;
}

['optTrim', 'optDropEmpty', 'optHeader'].forEach((id) => {
  $(id).addEventListener('change', () => { if (current) renderWorkbench(); });
});

/* ---------- Serializers ---------- */
function escCSV(v) {
  return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
}
function escTSV(v) {
  return /[\t\n\r"]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
}
const toCSV = (rows) => rows.map((r) => r.map(escCSV).join(',')).join('\r\n');
const toTSV = (rows) => rows.map((r) => r.map(escTSV).join('\t')).join('\r\n');

/* ---------- Workbench ---------- */
function selectTable(t) {
  current = t;
  renderWorkbench();
  $('workbench').classList.remove('hidden');
  $('workbench').scrollIntoView({ block: 'nearest' });
}

function renderWorkbench() {
  const rows = cleanRows(current.rows);
  $('wbLabel').textContent = current.label;
  $('wbDims').textContent = `(${rows.length} rows × ${rows.length ? rows[0].length : 0} cols)`;

  const preview = $('preview');
  preview.innerHTML = '';
  if (!rows.length) {
    preview.innerHTML = '<tbody><tr><td>No data after cleaning.</td></tr></tbody>';
    return;
  }
  const useHeader = $('optHeader').checked;
  const head = useHeader ? rows[0] : null;
  const body = useHeader ? rows.slice(1) : rows;

  const thead = document.createElement('thead');
  const hr = document.createElement('tr');
  const cols = head || rows[0];
  cols.forEach((c, i) => {
    const th = document.createElement('th');
    th.textContent = head ? (c || `Col ${i + 1}`) : `Col ${i + 1}`;
    th.title = th.textContent;
    hr.appendChild(th);
  });
  thead.appendChild(hr);
  preview.appendChild(thead);

  const tbody = document.createElement('tbody');
  body.slice(0, 10).forEach((r) => {
    const tr = document.createElement('tr');
    r.forEach((c) => {
      const td = document.createElement('td');
      td.textContent = c;
      td.title = c;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  preview.appendChild(tbody);
}

function cleanedForExport() {
  return cleanRows(current.rows);
}

async function flash(btn, text) {
  const original = btn.innerHTML;
  btn.innerHTML = text;
  setTimeout(() => { btn.innerHTML = original; }, 1400);
}

$('copyTsv').addEventListener('click', async (e) => {
  if (!current) return;
  try {
    await navigator.clipboard.writeText(toTSV(cleanedForExport()));
    flash(e.currentTarget, 'Copied ✓ — paste into Sheets');
  } catch {
    flash(e.currentTarget, 'Copy failed');
  }
});

function download(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  chrome.downloads.download({ url, filename, saveAs: true }, () => {
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  });
}

$('downloadCsv').addEventListener('click', () => {
  if (!current) return;
  download(toCSV(cleanedForExport()), 'sheets-ready.csv', 'text/csv;charset=utf-8');
});
$('downloadTsv').addEventListener('click', () => {
  if (!current) return;
  download(toTSV(cleanedForExport()), 'sheets-ready.tsv', 'text/tab-separated-values;charset=utf-8');
});

/* ---------- Init ---------- */
chrome.storage.local.get({ trim: true, dropEmpty: true, header: true }, (res) => {
  $('optTrim').checked = res.trim;
  $('optDropEmpty').checked = res.dropEmpty;
  $('optHeader').checked = res.header;
});
['optTrim', 'optDropEmpty', 'optHeader'].forEach((id) => {
  $(id).addEventListener('change', () => {
    chrome.storage.local.set({
      trim: $('optTrim').checked,
      dropEmpty: $('optDropEmpty').checked,
      header: $('optHeader').checked,
    });
  });
});
