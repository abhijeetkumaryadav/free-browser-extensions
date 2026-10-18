/* DedupeIQ — fuzzy duplicate row finder.
   All logic runs on-device. No network calls, no content scripts. */

'use strict';

const $ = (id) => document.getElementById(id);
const SAMPLE =
'name,email,city\n' +
'Ada Lovelace,ada@x.com,London\n' +
'Ada Lovelac,ada@x.com,London\n' +
'Grace Hopper,grace@navy.mil,New York\n' +
'grace hopper ,grace@navy.mil,New York\n' +
'Alan Turing,alan@bletchley.uk,Milton Keynes\n' +
'Alan Turing,alan@bletchley.uk,Milton Keynes';

/* ---------- CSV parsing (quoted fields supported) ---------- */
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.length && r.some(v => v.trim() !== ''));
}

/* ---------- Levenshtein similarity (0..1) ---------- */
function similarity(a, b) {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  const m = a.length, n = b.length;
  let prev = new Array(n + 1), cur = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    [prev, cur] = [cur, prev];
  }
  return 1 - prev[n] / Math.max(m, n);
}

/* ---------- state ---------- */
let headers = [], rows = [], keyCols = new Set(), groups = [];

/* ---------- step 1: load ---------- */
function loadData() {
  const text = $('csvInput').value.trim();
  const parsed = parseCSV(text);
  if (parsed.length < 2) {
    $('parseHint').textContent = 'Need at least a header row and one data row.';
    return;
  }
  headers = parsed[0];
  rows = parsed.slice(1).map((r, i) => ({ idx: i, cells: headers.map((_, c) => r[c] ?? '') }));
  keyCols = new Set(headers.map((_, i) => i)); // default: all columns
  $('rowCount').textContent = rows.length + ' rows';
  $('parseHint').textContent = `Parsed ${rows.length} rows × ${headers.length} columns.`;
  renderChips();
  $('stepConfig').classList.remove('hidden');
  $('stepResults').classList.add('hidden');
  persist();
}

function renderChips() {
  const box = $('colChips');
  box.innerHTML = '';
  headers.forEach((h, i) => {
    const el = document.createElement('button');
    el.className = 'chip' + (keyCols.has(i) ? ' on' : '');
    el.textContent = h || `col ${i + 1}`;
    el.title = 'Toggle key column';
    el.onclick = () => {
      keyCols.has(i) ? keyCols.delete(i) : keyCols.add(i);
      el.classList.toggle('on');
      if (keyCols.size === 0) { keyCols.add(i); el.classList.add('on'); } // keep ≥1
    };
    box.appendChild(el);
  });
}

/* ---------- step 2: scan ---------- */
function norm(v) {
  let s = v;
  if ($('chkTrim').checked) s = s.trim();
  if ($('chkCase').checked) s = s.toLowerCase();
  return s;
}

function rowKey(r) {
  return [...keyCols].map(i => norm(r.cells[i] ?? '')).join('\u0001');
}

function scan() {
  if (!keyCols.size) return;
  const threshold = $('threshold').value / 100;
  const keys = rows.map(rowKey);

  // union-find over rows linked by exact or fuzzy key match
  const parent = rows.map((_, i) => i);
  const find = (x) => parent[x] === x ? x : (parent[x] = find(parent[x]));
  const union = (a, b) => { parent[find(a)] = find(b); };

  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const ki = keys[i], kj = keys[j];
      if (ki === kj) { union(i, j); continue; }              // exact
      if (similarity(ki, kj) >= threshold) union(i, j);       // fuzzy
    }
  }
  const buckets = new Map();
  rows.forEach((r, i) => {
    const root = find(i);
    if (!buckets.has(root)) buckets.set(root, []);
    buckets.get(root).push(r);
  });
  groups = [...buckets.values()].filter(g => g.length > 1)
    .map(g => ({ members: g, keep: new Set([0]) }));          // default: keep first
  renderGroups();
  $('stepResults').classList.remove('hidden');
  persist();
}

/* ---------- step 3: results ---------- */
function esc(s) {
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function renderGroups() {
  const box = $('groups');
  box.innerHTML = '';
  $('groupCount').textContent = groups.length + ' group' + (groups.length === 1 ? '' : 's');
  if (!groups.length) {
    box.innerHTML = '<div class="empty">✓ No duplicates found at this threshold.</div>';
  }
  groups.forEach((g, gi) => {
    const div = document.createElement('div');
    div.className = 'group';
    const base = rowKey(g.members[0]);
    let html = `<div class="group-head">Group ${gi + 1} · ${g.members.length} rows</div>`;
    g.members.forEach((r, mi) => {
      const sim = Math.round(similarity(base, rowKey(r)) * 100);
      const exact = sim === 100;
      const vals = r.cells.map(c => esc(c)).join(' · ');
      html += `<label class="grow" title="Check to keep this row in the export">
        <input type="checkbox" data-g="${gi}" data-m="${mi}" ${g.keep.has(mi) ? 'checked' : ''}>
        <span class="gvals">${vals}</span>
        <span class="score ${exact ? 'exact' : 'fuzzy'}">${exact ? 'EXACT' : sim + '% match'}</span>
      </label>`;
    });
    div.innerHTML = html;
    box.appendChild(div);
  });
  box.querySelectorAll('input[type=checkbox]').forEach(cb => {
    cb.onchange = () => {
      const g = groups[+cb.dataset.g];
      +cb.dataset.m >= 0 && (cb.checked ? g.keep.add(+cb.dataset.m) : g.keep.delete(+cb.dataset.m));
      updateSummary();
    };
  });
  updateSummary();
}

function keptRows() {
  const removed = new Set();
  groups.forEach(g => g.members.forEach((r, mi) => { if (!g.keep.has(mi)) removed.add(r.idx); }));
  return rows.filter(r => !removed.has(r.idx));
}

function updateSummary() {
  const kept = keptRows();
  const removed = rows.length - kept.length;
  $('summary').innerHTML =
    `Keeping <b>${kept.length}</b> of <b>${rows.length}</b> rows · ` +
    `<b>${removed}</b> marked for removal.`;
}

function toCSV(data) {
  const q = v => /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  return [headers, ...data.map(r => r.cells)].map(r => r.map(q).join(',')).join('\n');
}

function downloadCSV() {
  const kept = keptRows();
  if (!kept.length) { $('summary').innerHTML = 'Nothing to export — check at least one row.'; return; }
  const blob = new Blob([toCSV(kept)], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'deduped.csv';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/* ---------- persistence (settings only, never the data) ---------- */
function persist() {
  chrome.storage.local.set({
    ddq: { threshold: $('threshold').value, ci: $('chkCase').checked, trim: $('chkTrim').checked }
  }).catch(() => {});
}
function restore() {
  chrome.storage.local.get('ddq').then(({ ddq }) => {
    if (!ddq) return;
    $('threshold').value = ddq.threshold ?? 85;
    $('thresholdVal').textContent = $('threshold').value + '%';
    $('chkCase').checked = ddq.ci !== false;
    $('chkTrim').checked = ddq.trim !== false;
  }).catch(() => {});
}

/* ---------- wiring ---------- */
$('btnLoad').onclick = loadData;
$('btnSample').onclick = () => { $('csvInput').value = SAMPLE; loadData(); };
$('btnClear').onclick = () => {
  $('csvInput').value = ''; headers = []; rows = []; groups = [];
  $('rowCount').textContent = '0 rows';
  $('stepConfig').classList.add('hidden');
  $('stepResults').classList.add('hidden');
  $('parseHint').textContent = 'First row is treated as the header. Quoted fields supported.';
};
$('threshold').oninput = e => { $('thresholdVal').textContent = e.target.value + '%'; };
$('btnScan').onclick = scan;
$('btnKeepFirst').onclick = () => {
  groups.forEach(g => { g.keep = new Set([0]); });
  renderGroups();
};
$('btnKeepNone').onclick = () => {
  groups.forEach(g => { g.keep = new Set(); });
  renderGroups();
};
$('btnExport').onclick = downloadCSV;
$('btnCopy').onclick = () => {
  const kept = keptRows();
  if (!kept.length) return;
  navigator.clipboard.writeText(toCSV(kept)).then(() => {
    $('btnCopy').textContent = 'Copied!';
    setTimeout(() => $('btnCopy').textContent = 'Copy', 1500);
  }).catch(() => {});
};
restore();
