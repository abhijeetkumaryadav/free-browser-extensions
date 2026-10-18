/* =====================================================================
 * ColumnClean — popup logic
 * Pure on-device CSV column standardizer. No network, no remote code.
 * Transforms: trim, case normalize, date normalize, number/currency
 * normalize, duplicate-row removal — with live before/after preview.
 * ===================================================================== */
'use strict';

/* --------------------------- CSV parsing --------------------------- */
/* RFC-4180-ish: handles quoted fields, escaped quotes, embedded \n.  */
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQ = false;
      } else field += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\r') { /* skip */ }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.length > 1 || r[0].trim() !== '');
}
function toCSV(rows) {
  return rows.map(r => r.map(c => {
    c = String(c ?? '');
    return /[",\n\r]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c;
  }).join(',')).join('\n');
}

/* ------------------------- Transformations ------------------------- */
const MONTHS = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 };

function parseDate(v, dayFirst) {
  v = v.trim();
  if (!v) return null;
  let m;
  // YYYY-MM-DD / YYYY/MM/DD (+ optional time)
  if ((m = v.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/))) return d(+m[1], +m[2], +m[3]);
  // YYYYMMDD
  if ((m = v.match(/^(\d{4})(\d{2})(\d{2})$/))) return d(+m[1], +m[2], +m[3]);
  // DD-Mon-YYYY / Mon DD, YYYY / DD Mon YYYY
  if ((m = v.match(/^(\d{1,2})[- ]([A-Za-z]{3,9})[- ,]*(\d{4})/))) {
    const mo = MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (mo) return d(+m[3], mo, +m[1]);
  }
  if ((m = v.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})/))) {
    const mo = MONTHS[m[1].slice(0, 3).toLowerCase()];
    if (mo) return d(+m[3], mo, +m[2]);
  }
  // DD/MM/YYYY or MM/DD/YYYY (ambiguous -> dayFirst decides)
  if ((m = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/))) {
    let y = +m[3]; if (y < 100) y += 2000;
    const a = +m[1], b = +m[2];
    if (a > 12 && b <= 12) return d(y, b, a);       // clearly D/M
    if (b > 12 && a <= 12) return d(y, a, b);       // clearly M/D
    return dayFirst ? d(y, b, a) : d(y, a, b);
  }
  const t = Date.parse(v);
  if (!isNaN(t)) { const dt = new Date(t); return { y: dt.getFullYear(), mo: dt.getMonth() + 1, dd: dt.getDate() }; }
  return null;
  function d(y, mo, dd) {
    if (mo < 1 || mo > 12 || dd < 1 || dd > 31) return null;
    return { y, mo, dd };
  }
}
function formatDate(dt, fmt) {
  const p = n => String(n).padStart(2, '0');
  const names = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  switch (fmt) {
    case 'dmy': return `${p(dt.dd)}/${p(dt.mo)}/${dt.y}`;
    case 'mdy': return `${p(dt.mo)}/${p(dt.dd)}/${dt.y}`;
    case 'dmytext': return `${dt.dd} ${names[dt.mo]} ${dt.y}`;
    default: return `${dt.y}-${p(dt.mo)}-${p(dt.dd)}`;
  }
}
function normalizeNumber(v) {
  let s = String(v).trim();
  if (!s) return s;
  let pct = false;
  if (s.endsWith('%')) { pct = true; s = s.slice(0, -1).trim(); }
  s = s.replace(/[$€£¥₹\s']/g, '');
  const lastDot = s.lastIndexOf('.'), lastComma = s.lastIndexOf(',');
  if (lastDot > -1 && lastComma > -1) {
    // The later separator is the decimal one.
    if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (lastComma > -1) {
    const frac = s.slice(lastComma + 1);
    s = /^\d{1,2}$/.test(frac) && s.indexOf(',') === lastComma
      ? s.slice(0, lastComma) + '.' + frac   // decimal comma
      : s.replace(/,/g, '');                 // thousands separator
  }
  if (!/^-?\d*\.?\d+$/.test(s)) return String(v).trim(); // not a number — leave as-is
  const num = parseFloat(s);
  return pct ? String(num) : String(num);
}
function titleCase(s) {
  return s.toLowerCase().replace(/(^|\s|[(\-'])(\S)/g, (m, p, c) => p + c.toUpperCase());
}

function applyTransforms(value, xforms, dateFmt, dayFirst) {
  let v = value;
  if (xforms.trim) v = v.trim();
  if (xforms.caseUpper) v = v.toUpperCase();
  else if (xforms.caseLower) v = v.toLowerCase();
  else if (xforms.caseTitle) v = titleCase(v);
  if (xforms.date) {
    const dt = parseDate(v, dayFirst);
    if (dt) v = formatDate(dt, dateFmt);
  }
  if (xforms.num) v = normalizeNumber(v);
  return v;
}

/* ------------------------------- UI -------------------------------- */
const $ = id => document.getElementById(id);
const escapeHtml = s => String(s).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let data = null;      // { headers:[], rows:[[]] }
let cleaned = null;   // transformed rows (same shape)
let colIdx = 0;

function getXforms() {
  const o = {};
  document.querySelectorAll('.xf').forEach(c => { o[c.dataset.xf] = c.checked; });
  return o;
}

function recompute() {
  if (!data) return;
  const hasHeader = $('hasHeader').checked;
  const bodyRows = hasHeader ? data.rows.slice(1) : data.rows;
  const headers = hasHeader ? data.rows[0] : data.rows[0].map((_, i) => `Column ${i + 1}`);
  const xforms = getXforms();
  const dateFmt = $('dateFmt').value;
  const dayFirst = $('dayFirst').checked;

  // Column width may change if header row toggled; clamp.
  colIdx = Math.min(colIdx, headers.length - 1);

  let out = bodyRows.map(r => r.slice());
  let changedCells = 0;
  const changedMap = new Set();
  out.forEach((r, ri) => {
    const before = r[colIdx] ?? '';
    const after = applyTransforms(before, xforms, dateFmt, dayFirst);
    if (after !== before) { changedCells++; changedMap.add(ri); }
    r[colIdx] = after;
  });

  // De-duplicate by selected column (keep first).
  let removed = 0;
  if (xforms.dedup) {
    const seen = new Set();
    out = out.filter((r, ri) => {
      const k = r[colIdx] ?? '';
      if (seen.has(k)) { removed++; return false; }
      seen.add(k); return true;
    });
  }

  cleaned = hasHeader ? [headers, ...out] : out;

  // Stats.
  $('stats').innerHTML =
    `<span class="stat"><b>${out.length}</b> rows</span>` +
    `<span class="stat"><b>${changedCells}</b> cells changed</span>` +
    (removed ? `<span class="stat"><b>${removed}</b> duplicates removed</span>` : '') +
    `<span class="stat">column <b>${escapeHtml(headers[colIdx])}</b></span>`;
  $('rowCount').textContent = `${out.length} rows × ${headers.length} cols`;

  // Preview (first 20).
  const prev = hasHeader ? [headers, ...out.slice(0, 20)] : out.slice(0, 20);
  const origPrev = hasHeader ? [headers, ...bodyRows.slice(0, 20)] : bodyRows.slice(0, 20);
  let html = '<thead><tr>' + headers.map((h, i) =>
    `<th class="${i === colIdx ? 'selcol' : ''}">${escapeHtml(h)}</th>`).join('') + '</tr></thead><tbody>';
  prev.slice(hasHeader ? 1 : 0).forEach((r, ri) => {
    html += '<tr>' + r.map((c, ci) => {
      const changed = origPrev[hasHeader ? ri + 1 : ri][ci] !== c;
      return `<td class="${ci === colIdx ? 'selcol' : ''}${changed ? ' changed' : ''}" title="${escapeHtml(c)}">${escapeHtml(c)}</td>`;
    }).join('') + '</tr>';
  });
  $('previewBody').innerHTML = html;
}

function loadData() {
  const text = $('csvIn').value.trim();
  if (!text) { $('csvIn').focus(); return; }
  const rows = parseCSV(text);
  if (rows.length < 2) {
    $('stats').innerHTML = '<span class="stat">Need at least a header row and one data row.</span>';
    return;
  }
  // Normalize ragged rows.
  const w = Math.max(...rows.map(r => r.length));
  data = { rows: rows.map(r => { while (r.length < w) r.push(''); return r.slice(0, w); }) };
  const headers = $('hasHeader').checked ? data.rows[0] : data.rows[0].map((_, i) => `Column ${i + 1}`);
  $('colSel').innerHTML = headers.map((h, i) =>
    `<option value="${i}">${escapeHtml(h || `Column ${i + 1}`)}</option>`).join('');
  colIdx = 0;
  $('stepWork').classList.remove('hidden');
  recompute();
  chrome.storage.local.set({ csvDraft: text }).catch(() => {});
}

$('loadBtn').addEventListener('click', loadData);
$('colSel').addEventListener('change', e => { colIdx = +e.target.value; recompute(); });
$('hasHeader').addEventListener('change', loadData);
document.querySelectorAll('.xf').forEach(c => c.addEventListener('change', recompute));
$('dateFmt').addEventListener('change', recompute);
$('dayFirst').addEventListener('change', recompute);

$('clearBtn').addEventListener('click', () => {
  data = cleaned = null;
  $('csvIn').value = '';
  $('stepWork').classList.add('hidden');
  $('rowCount').textContent = '';
  chrome.storage.local.remove('csvDraft').catch(() => {});
});

$('downloadBtn').addEventListener('click', () => {
  if (!cleaned) return;
  const blob = new Blob([toCSV(cleaned)], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'cleaned.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
});
$('copyBtn').addEventListener('click', async () => {
  if (!cleaned) return;
  try { await navigator.clipboard.writeText(toCSV(cleaned)); $('copyBtn').textContent = 'Copied!'; }
  catch { $('copyBtn').textContent = 'Copy failed'; }
  setTimeout(() => { $('copyBtn').textContent = 'Copy'; }, 1500);
});

// Restore draft.
chrome.storage.local.get('csvDraft').then(r => {
  if (r.csvDraft) { $('csvIn').value = r.csvDraft; loadData(); }
}).catch(() => {});
