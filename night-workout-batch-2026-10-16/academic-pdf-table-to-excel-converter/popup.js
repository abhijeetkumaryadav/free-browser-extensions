// Table Grabber — popup logic
const $ = id => document.getElementById(id);
let tables = [];      // scanned tables from the page
let selected = -1;    // index into tables

// Runs inside the page via chrome.scripting (click-only). Pure data, no DOM changes.
function scanTables() {
  const out = [];
  document.querySelectorAll('table').forEach((t, i) => {
    const rows = [];
    t.querySelectorAll('tr').forEach(tr => {
      const cells = [];
      tr.querySelectorAll('th, td').forEach(c => cells.push(c.innerText.trim()));
      if (cells.some(v => v !== '')) rows.push(cells);
    });
    if (!rows.length) return;
    const maxCols = Math.max(...rows.map(r => r.length));
    if (rows.length < 2 && maxCols < 2) return; // skip layout-only tables
    out.push({
      index: i,
      rows: rows.length,
      cols: maxCols,
      caption: (t.caption ? t.caption.innerText.trim() : '') || `Table ${i + 1}`,
      data: rows
    });
  });
  return out;
}

function setStatus(msg, isErr) {
  const s = $('status');
  s.textContent = msg;
  s.classList.toggle('err', !!isErr);
}

$('scanBtn').addEventListener('click', async () => {
  setStatus('Scanning…');
  $('tableListWrap').classList.add('hidden');
  $('previewWrap').classList.add('hidden');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id || /^chrome:\/\//.test(tab.url || '')) {
      setStatus('Open a normal web page first — this cannot run on chrome:// pages.', true);
      return;
    }
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: scanTables
    });
    tables = result || [];
    selected = -1;
    if (!tables.length) { setStatus('No data tables found on this page.', true); return; }
    setStatus(`Found ${tables.length} table${tables.length > 1 ? 's' : ''}. Pick one to preview.`);
    renderList();
    $('tableListWrap').classList.remove('hidden');
  } catch (e) {
    setStatus('Scan failed: ' + (e.message || e), true);
  }
});

function renderList() {
  const list = $('tableList');
  list.innerHTML = '';
  tables.forEach((t, i) => {
    const b = document.createElement('button');
    b.className = 'titem' + (i === selected ? ' sel' : '');
    b.innerHTML = `<b>${escapeHtml(t.caption)}</b> — ${t.rows} rows × ${t.cols} cols`;
    b.addEventListener('click', () => { selected = i; renderList(); renderPreview(); });
    list.appendChild(b);
  });
}

function renderPreview() {
  const t = tables[selected];
  if (!t) return;
  const bar = $('colBar'); bar.innerHTML = '';
  for (let c = 0; c < t.cols; c++) {
    const lbl = document.createElement('label');
    const cb = document.createElement('input');
    cb.type = 'checkbox'; cb.checked = true; cb.dataset.col = c;
    lbl.appendChild(cb);
    lbl.appendChild(document.createTextNode(' Col ' + (c + 1)));
    bar.appendChild(lbl);
  }
  drawGrid();
  $('previewWrap').classList.remove('hidden');
  bar.querySelectorAll('input').forEach(cb => cb.addEventListener('change', drawGrid));
}

function chosenCols() {
  const out = [];
  document.querySelectorAll('#colBar input:checked').forEach(cb => out.push(+cb.dataset.col));
  return out;
}

function drawGrid() {
  const t = tables[selected];
  const cols = chosenCols();
  const pv = $('preview');
  pv.innerHTML = '';
  if (!cols.length) { pv.textContent = 'Tick at least one column.'; return; }
  const el = document.createElement('table');
  t.data.slice(0, 30).forEach((row, ri) => {
    const tr = document.createElement('tr');
    cols.forEach(c => {
      const cell = document.createElement(ri === 0 ? 'th' : 'td');
      cell.textContent = row[c] || '';
      tr.appendChild(cell);
    });
    el.appendChild(tr);
  });
  pv.appendChild(el);
}

function toCsv(rows, cols) {
  const esc = v => {
    v = (v == null ? '' : String(v));
    return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  };
  return '\uFEFF' + rows.map(r => cols.map(c => esc(r[c] || '')).join(',')).join('\r\n');
}

$('exportBtn').addEventListener('click', () => {
  const t = tables[selected]; const cols = chosenCols();
  if (!t || !cols.length) { setStatus('Select a table and at least one column.', true); return; }
  const csv = toCsv(t.data, cols);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'table-' + (selected + 1) + '.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  setStatus('CSV downloaded — opens in Excel.');
});

$('copyBtn').addEventListener('click', async () => {
  const t = tables[selected]; const cols = chosenCols();
  if (!t || !cols.length) { setStatus('Select a table and at least one column.', true); return; }
  try { await navigator.clipboard.writeText(toCsv(t.data, cols)); setStatus('CSV copied to clipboard.'); }
  catch (e) { setStatus('Copy failed: ' + (e.message || e), true); }
});

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
