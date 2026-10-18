/* ChunkTable — large CSV lazy viewer.
 * Streaming chunked parse (FileReader slices, RFC-4180-ish) + virtualized
 * table: only visible rows are rendered in the DOM. All on-device. */
'use strict';

const ROW_H = 30;          // matches .trow height in CSS
const CHUNK_SIZE = 256 * 1024; // 256 KB read slices

const els = {
  dropzone: document.getElementById('dropzone'),
  fileInput: document.getElementById('fileInput'),
  browseBtn: document.getElementById('browseBtn'),
  parseProgress: document.getElementById('parseProgress'),
  parseFill: document.getElementById('parseFill'),
  parseLabel: document.getElementById('parseLabel'),
  viewerCard: document.getElementById('viewerCard'),
  statsRow: document.getElementById('statsRow'),
  colSelect: document.getElementById('colSelect'),
  searchInput: document.getElementById('searchInput'),
  jumpInput: document.getElementById('jumpInput'),
  jumpBtn: document.getElementById('jumpBtn'),
  headerToggle: document.getElementById('headerToggle'),
  clearBtn: document.getElementById('clearBtn'),
  tableCard: document.getElementById('tableCard'),
  tableHead: document.getElementById('tableHead'),
  viewport: document.getElementById('viewport'),
  spacer: document.getElementById('spacer'),
  rows: document.getElementById('rows'),
  tableFoot: document.getElementById('tableFoot'),
  fileBadge: document.getElementById('fileBadge')
};

let state = {
  fileName: '',
  allRows: [],        // parsed rows (arrays of strings)
  viewRows: [],       // filtered row indices into allRows (data rows only)
  headers: [],
  hasHeader: true,
  filterCol: -1,      // -1 = all columns
  query: ''
};

/* ---------- CSV parsing (streaming, quote-aware) ---------- */

// Parses a text buffer, carrying an unfinished line across chunk boundaries.
// Returns { rows, leftover }.
function parseChunk(text, leftover) {
  const data = leftover + text;
  const rows = [];
  let field = '', record = [], inQuotes = false, i = 0, recStart = 0;

  while (i < data.length) {
    const c = data[i];
    if (inQuotes) {
      if (c === '"') {
        if (data[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === ',') { record.push(field); field = ''; i++; continue; }
    if (c === '\r' && data[i + 1] === '\n') { record.push(field); rows.push(record); record = []; field = ''; i += 2; recStart = i; continue; }
    if (c === '\n' || c === '\r') { record.push(field); rows.push(record); record = []; field = ''; i++; recStart = i; continue; }
    field += c; i++;
  }
  // Carry the unfinished record (including a mid-quote one) into next chunk.
  return { rows, leftover: data.slice(recStart) };
}

async function parseFileStreaming(file) {
  state.allRows = [];
  const total = file.size;
  let offset = 0, leftover = '', parsedBytes = 0;
  els.parseProgress.classList.remove('hidden');

  while (offset < total) {
    const slice = file.slice(offset, offset + CHUNK_SIZE);
    const text = await slice.text();
    const { rows, leftover: lo } = parseChunk(text, leftover);
    leftover = lo;
    state.allRows.push(...rows);
    offset += CHUNK_SIZE;
    parsedBytes = Math.min(offset, total);
    const pct = Math.round((parsedBytes / total) * 100);
    els.parseFill.style.width = pct + '%';
    els.parseLabel.textContent = `Parsing… ${pct}% (${state.allRows.length.toLocaleString()} rows)`;
    // Yield so the UI stays responsive between chunks.
    await new Promise(r => setTimeout(r, 0));
  }
  // Flush the final leftover as a record if it holds data.
  if (leftover.trim() !== '') {
    const { rows } = parseChunk('\n', leftover);
    state.allRows.push(...rows);
  }
  els.parseProgress.classList.add('hidden');
}

/* ---------- View / filter ---------- */

function dataRows() {
  return state.hasHeader ? state.allRows.slice(1) : state.allRows;
}

function applyFilter() {
  const rows = dataRows();
  const q = state.query.trim().toLowerCase();
  if (!q) {
    state.viewRows = rows.map((_, i) => i);
  } else {
    state.viewRows = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (state.filterCol >= 0) {
        if ((r[state.filterCol] || '').toLowerCase().includes(q)) state.viewRows.push(i);
      } else {
        for (const cell of r) {
          if ((cell || '').toLowerCase().includes(q)) { state.viewRows.push(i); break; }
        }
      }
    }
  }
  renderHead();
  renderStats();
  layoutViewport();
  renderRows();
}

function renderHead() {
  const cols = state.headers;
  const colCount = Math.max(cols.length, ...state.allRows.map(r => r.length), 1);
  els.tableHead.style.gridTemplateColumns = `44px repeat(${colCount}, minmax(110px,1fr))`;
  let html = '<span class="idx" style="min-width:44px;max-width:44px">#</span>';
  for (let i = 0; i < colCount; i++) {
    const label = cols[i] || `Column ${i + 1}`;
    html += `<span title="${escapeHtml(label)}">${escapeHtml(label)}</span>`;
  }
  els.tableHead.innerHTML = html;

  // Column filter dropdown
  els.colSelect.innerHTML = '<option value="-1">All columns</option>' +
    Array.from({ length: colCount }, (_, i) =>
      `<option value="${i}">${escapeHtml(cols[i] || 'Column ' + (i + 1))}</option>`).join('');
  els.colSelect.value = String(state.filterCol);
}

function renderStats() {
  const total = state.allRows.length;
  const data = dataRows().length;
  const shown = state.viewRows.length;
  const cols = Math.max(...state.allRows.map(r => r.length), 0);
  els.statsRow.innerHTML =
    `<span class="stat">Rows<b>${data.toLocaleString()}</b></span>` +
    `<span class="stat">Columns<b>${cols}</b></span>` +
    (state.query ? `<span class="stat">Matches<b>${shown.toLocaleString()}</b></span>` :
                   `<span class="stat">Total lines<b>${total.toLocaleString()}</b></span>`);
  els.tableFoot.textContent = state.query
    ? `Showing ${shown.toLocaleString()} of ${data.toLocaleString()} rows`
    : `${data.toLocaleString()} rows · scroll to lazy-render · jump to any row above`;
}

/* ---------- Virtualized rendering ---------- */

function layoutViewport() {
  els.spacer.style.height = (state.viewRows.length * ROW_H) + 'px';
}

function renderRows() {
  const vp = els.viewport;
  const start = Math.max(0, Math.floor(vp.scrollTop / ROW_H) - 3);
  const count = Math.ceil(vp.clientHeight / ROW_H) + 6;
  const rows = dataRows();
  const colCount = Math.max(...state.allRows.map(r => r.length), 1);

  let html = '';
  for (let k = start; k < Math.min(start + count, state.viewRows.length); k++) {
    const dataIdx = state.viewRows[k];
    const r = rows[dataIdx];
    const top = k * ROW_H;
    html += `<div class="trow" style="position:absolute;top:${top}px;left:0;right:0;grid-template-columns:44px repeat(${colCount}, minmax(110px,1fr))">` +
      `<span class="idx">${(dataIdx + 1).toLocaleString()}</span>`;
    for (let c = 0; c < colCount; c++) {
      const v = r[c] ?? '';
      html += `<span title="${escapeHtml(v)}">${escapeHtml(v)}</span>`;
    }
    html += '</div>';
  }
  els.rows.innerHTML = html;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

/* ---------- File handling ---------- */

async function loadFile(file) {
  if (!file) return;
  state.fileName = file.name;
  state.hasHeader = els.headerToggle.checked;
  state.filterCol = -1;
  state.query = '';
  els.searchInput.value = '';
  els.jumpInput.value = '';
  els.fileBadge.textContent = file.name;
  els.fileBadge.classList.add('loaded');

  await parseFileStreaming(file);

  // Normalize column counts and derive headers
  const colCount = Math.max(...state.allRows.map(r => r.length), 1);
  state.allRows.forEach(r => { while (r.length < colCount) r.push(''); });
  state.headers = state.hasHeader && state.allRows.length
    ? state.allRows[0].slice()
    : Array.from({ length: colCount }, (_, i) => `Column ${i + 1}`);

  els.viewerCard.classList.remove('hidden');
  els.tableCard.classList.remove('hidden');
  els.viewport.scrollTop = 0;
  applyFilter();
}

function clearFile() {
  state = { fileName: '', allRows: [], viewRows: [], headers: [], hasHeader: true, filterCol: -1, query: '' };
  els.fileBadge.textContent = 'no file';
  els.fileBadge.classList.remove('loaded');
  els.viewerCard.classList.add('hidden');
  els.tableCard.classList.add('hidden');
  els.searchInput.value = '';
  els.jumpInput.value = '';
}

/* ---------- Events ---------- */

els.browseBtn.addEventListener('click', e => { e.stopPropagation(); els.fileInput.click(); });
els.dropzone.addEventListener('click', () => els.fileInput.click());
els.fileInput.addEventListener('change', () => loadFile(els.fileInput.files[0]));
els.dropzone.addEventListener('dragover', e => { e.preventDefault(); els.dropzone.classList.add('dragover'); });
els.dropzone.addEventListener('dragleave', () => els.dropzone.classList.remove('dragover'));
els.dropzone.addEventListener('drop', e => {
  e.preventDefault();
  els.dropzone.classList.remove('dragover');
  if (e.dataTransfer.files.length) loadFile(e.dataTransfer.files[0]);
});

let searchTimer = null;
els.searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.query = els.searchInput.value;
    els.viewport.scrollTop = 0;
    applyFilter();
  }, 180);
});
els.colSelect.addEventListener('change', () => {
  state.filterCol = parseInt(els.colSelect.value, 10);
  els.viewport.scrollTop = 0;
  applyFilter();
});
els.headerToggle.addEventListener('change', () => {
  state.hasHeader = els.headerToggle.checked;
  const colCount = Math.max(...state.allRows.map(r => r.length), 1);
  state.headers = state.hasHeader && state.allRows.length
    ? state.allRows[0].slice()
    : Array.from({ length: colCount }, (_, i) => `Column ${i + 1}`);
  applyFilter();
});
els.jumpBtn.addEventListener('click', () => {
  const n = parseInt(els.jumpInput.value, 10);
  if (!n || n < 1) return;
  // Find the position of data-row n within the current filtered view.
  const pos = state.viewRows.indexOf(n - 1);
  const target = pos >= 0 ? pos : Math.min(n - 1, state.viewRows.length - 1);
  els.viewport.scrollTop = Math.max(0, target * ROW_H - els.viewport.clientHeight / 2);
  renderRows();
});
els.jumpInput.addEventListener('keydown', e => { if (e.key === 'Enter') els.jumpBtn.click(); });
els.clearBtn.addEventListener('click', clearFile);

let scrollRaf = null;
els.viewport.addEventListener('scroll', () => {
  if (scrollRaf) return;
  scrollRaf = requestAnimationFrame(() => { scrollRaf = null; renderRows(); });
});
