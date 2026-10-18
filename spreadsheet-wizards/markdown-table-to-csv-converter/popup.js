/* Tablix — Markdown table detector + CSV converter.
   All logic runs on-device. No network calls, no content scripts. */

'use strict';

const $ = (id) => document.getElementById(id);
const SAMPLE =
'# Team\n\n' +
'| Name | Role | Location |\n' +
'| :--- | :---: | ---: |\n' +
'| Ada Lovelace | Engineer | London |\n' +
'| Grace Hopper | Admiral \\| Legend | New York |\n\n' +
'Some text between tables.\n\n' +
'| SKU | Price |\n' +
'| --- | --- |\n' +
'| A-1 | 9.99 |\n' +
'| B-2 | 19.99 |';

/* ---------- Markdown table detection ---------- */

// A separator row like | --- | :---: | ---: |
function isSeparatorRow(line) {
  const t = line.trim();
  if (!t.includes('|')) return false;
  const cells = splitCells(t);
  if (!cells.length) return false;
  return cells.every(c => /^:?-+:?$/.test(c.trim()) && c.trim().length >= 3);
}

// Split a table row on unescaped pipes; strip outer pipes; unescape \|.
// Pipes inside inline code spans (`...`) do NOT split — the masked line
// locates boundaries, the original line is sliced at those positions.
function splitCells(line) {
  let t = line.trim();
  if (t.startsWith('|')) t = t.slice(1);
  if (t.endsWith('|') && !t.endsWith('\\|')) t = t.slice(0, -1);
  const masked = t.replace(/`[^`]*`/g, m => 'x'.repeat(m.length));
  const bounds = [];
  for (let i = 0; i < masked.length; i++) {
    if (masked[i] === '|' && !(masked[i - 1] === '\\')) bounds.push(i);
  }
  const cells = [];
  let prev = 0;
  for (const b of bounds) { cells.push(t.slice(prev, b)); prev = b + 1; }
  cells.push(t.slice(prev));
  return cells.map(c => c.trim().replace(/\\\|/g, '|'));
}

function isRowLine(line) {
  return line.trim().startsWith('|') && line.includes('|');
}

// Strip inline code spans so pipes inside code don't confuse detection
function maskCode(line) {
  return line.replace(/`[^`]*`/g, m => 'x'.repeat(m.length));
}

function detectTables(text) {
  const lines = text.split('\n');
  const tables = [];
  let i = 0;
  while (i < lines.length) {
    if (isRowLine(maskCode(lines[i])) && i + 1 < lines.length && isSeparatorRow(lines[i + 1])) {
      const header = splitCells(lines[i]);
      const rows = [];
      i += 2;
      while (i < lines.length && isRowLine(maskCode(lines[i]))) {
        rows.push(splitCells(lines[i]));
        i++;
      }
      // normalize column count
      const n = Math.max(header.length, ...rows.map(r => r.length));
      const pad = (r) => { while (r.length < n) r.push(''); return r.slice(0, n); };
      tables.push({ header: pad(header), rows: rows.map(pad) });
    } else i++;
  }
  return tables;
}

/* ---------- CSV ---------- */
function toCSV(table, delim) {
  const q = v => (v.includes(delim) || /[",\n]/.test(v)) ? `"${v.replace(/"/g, '""')}"` : v;
  return [table.header, ...table.rows].map(r => r.map(q).join(delim)).join('\n');
}

function esc(s) {
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

/* ---------- render ---------- */
let tables = [];
const DELIM_NAMES = { ',': 'Comma', ';': 'Semicolon', '\t': 'Tab', '|': 'Pipe' };

function convert() {
  tables = detectTables($('mdInput').value);
  $('tableCount').textContent = tables.length + ' table' + (tables.length === 1 ? '' : 's');
  $('resultsCard').classList.toggle('hidden', false);
  renderTables();
}

function renderTables() {
  const box = $('tables');
  box.innerHTML = '';
  const delim = $('delimiter').value;
  $('delimName').textContent = DELIM_NAMES[delim] || 'Comma';
  if (!tables.length) {
    box.innerHTML = '<div class="empty">No Markdown tables detected. Tables need a header row followed by a separator row (<code>| --- |</code>).</div>';
    return;
  }
  tables.forEach((t, ti) => {
    const card = document.createElement('div');
    card.className = 'table-card';
    const head = `<th>${t.header.map(esc).join('</th><th>')}</th>`;
    const body = t.rows.map(r => `<tr>${r.map(c => `<td title="${esc(c)}">${esc(c)}</td>`).join('')}</tr>`).join('');
    card.innerHTML = `
      <div class="table-head">
        <span class="t">Table ${ti + 1}</span>
        <span class="d">${t.rows.length} rows × ${t.header.length} cols</span>
      </div>
      <div class="preview"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>
      <div class="row">
        <button class="btn ghost sm" data-act="copy" data-i="${ti}">Copy CSV</button>
        <button class="btn primary sm" data-act="dl" data-i="${ti}">Download CSV</button>
      </div>`;
    box.appendChild(card);
  });
  box.querySelectorAll('button[data-act]').forEach(b => {
    b.onclick = () => {
      const t = tables[+b.dataset.i];
      const csv = toCSV(t, $('delimiter').value);
      if (b.dataset.act === 'copy') {
        navigator.clipboard.writeText(csv).then(() => {
          b.textContent = 'Copied!';
          setTimeout(() => b.textContent = 'Copy CSV', 1500);
        }).catch(() => {});
      } else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
        a.download = `table-${+b.dataset.i + 1}.csv`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      }
    };
  });
}

/* ---------- wiring ---------- */
$('btnConvert').onclick = convert;
$('btnSample').onclick = () => { $('mdInput').value = SAMPLE; convert(); };
$('btnClear').onclick = () => {
  $('mdInput').value = ''; tables = [];
  $('tableCount').textContent = '0 tables';
  $('resultsCard').classList.add('hidden');
};
$('delimiter').onchange = () => {
  renderTables();
  chrome.storage.local.set({ tdx: { delim: $('delimiter').value } }).catch(() => {});
};
chrome.storage.local.get('tdx').then(({ tdx }) => {
  if (tdx && tdx.delim) { $('delimiter').value = tdx.delim; }
}).catch(() => {});
