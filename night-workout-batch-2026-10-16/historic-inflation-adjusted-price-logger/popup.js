// PriceLog — price logbook with inflation adjustment.
// All data stays in chrome.storage.local. CPI table is a bundled APPROXIMATION
// (US CPI-U annual averages, rounded), not official figures. User can edit it.

'use strict';

/** Default CPI reference table: year -> approximate annual CPI-U average.
 *  Clearly labeled as approximate in the UI. 2025-2026 are estimates. */
const DEFAULT_CPI = {
  1990: 130.7, 1991: 136.2, 1992: 140.3, 1993: 144.5, 1994: 148.2,
  1995: 152.4, 1996: 156.9, 1997: 160.5, 1998: 163.0, 1999: 166.6,
  2000: 172.2, 2001: 177.1, 2002: 179.9, 2003: 184.0, 2004: 188.9,
  2005: 195.3, 2006: 201.6, 2007: 207.3, 2008: 215.3, 2009: 214.5,
  2010: 218.1, 2011: 224.9, 2012: 229.6, 2013: 233.0, 2014: 236.7,
  2015: 237.0, 2016: 240.0, 2017: 245.1, 2018: 251.1, 2019: 255.7,
  2020: 258.8, 2021: 271.0, 2022: 292.7, 2023: 304.7, 2024: 314.2,
  2025: 321.5, 2026: 329.0
};

const KEY_ENTRIES = 'pricelog.entries';
const KEY_CPI = 'pricelog.cpi';

const $ = (id) => document.getElementById(id);

/* ---------- storage helpers ---------- */
function getStore() {
  return new Promise((res) => chrome.storage.local.get([KEY_ENTRIES, KEY_CPI], (v) => res(v)));
}
function setStore(patch) {
  return new Promise((res) => chrome.storage.local.set(patch, res));
}

/* ---------- CPI helpers ---------- */
function getCpiForYear(cpi, year) {
  const years = Object.keys(cpi).map(Number).sort((a, b) => a - b);
  if (!years.length) return 1;
  const target = Number(year);
  if (target <= years[0]) return cpi[years[0]];
  if (target >= years[years.length - 1]) return cpi[years[years.length - 1]];
  return cpi[target] ?? cpi[years.reduce((p, y) => (y <= target ? y : p), years[0])];
}

/** Convert a nominal price from `year` into current-money terms. */
function adjustToCurrent(nominal, year, cpi) {
  const cpiYear = getCpiForYear(cpi, year);
  const cpiNow = getCpiForYear(cpi, new Date().getFullYear());
  if (!cpiYear) return nominal;
  return nominal * (cpiNow / cpiYear);
}

const fmt$ = (n) => '$' + Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ---------- rendering ---------- */
function renderEntries(entries, cpi) {
  const box = $('entries');
  $('statCount').textContent = entries.length;
  if (!entries.length) {
    box.innerHTML = '<p class="empty">No entries yet. Log your first price above.</p>';
    $('tNominal').textContent = '—';
    $('tAdjusted').textContent = '—';
    drawChart([]);
    return;
  }
  const sorted = [...entries].sort((a, b) => b.created - a.created);
  let nom = 0, adj = 0;
  box.innerHTML = '';
  for (const e of sorted) {
    const a = adjustToCurrent(e.price, e.year, cpi);
    nom += e.price; adj += a;
    const row = document.createElement('div');
    row.className = 'entry';
    row.innerHTML = `
      <div class="grow">
        <div class="name"></div>
        <div class="dates">${escapeHtml(e.dateLabel)}</div>
      </div>
      <div class="vals">
        <div class="nom">${fmt$(e.price)} nominal</div>
        <div class="adj">${fmt$(a)} today</div>
      </div>
      <button class="del" title="Delete entry" aria-label="Delete entry">&times;</button>`;
    row.querySelector('.name').textContent = e.item;
    row.querySelector('.del').addEventListener('click', () => deleteEntry(e.id));
    box.appendChild(row);
  }
  $('tNominal').textContent = fmt$(nom);
  $('tAdjusted').textContent = fmt$(adj);
  drawChart(sorted, cpi);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Draw nominal vs adjusted lines on the SVG chart. */
function drawChart(entries, cpi = {}) {
  const svg = $('chart');
  svg.innerHTML = '';
  const W = 340, H = 150, P = 12;
  const NS = 'http://www.w3.org/2000/svg';
  const grid = document.createElementNS(NS, 'line');
  if (!entries || !entries.length) return;
  const pts = [...entries].sort((a, b) => a.created - b.created).map((e) => ({
    nom: e.price,
    adj: adjustToCurrent(e.price, e.year, cpi)
  }));
  const max = Math.max(...pts.map((p) => Math.max(p.nom, p.adj)), 1);
  const x = (i) => P + (pts.length === 1 ? (W - 2 * P) / 2 : (i / (pts.length - 1)) * (W - 2 * P));
  const y = (v) => H - P - (v / max) * (H - 2 * P);
  const line = (key, color) => {
    const pl = document.createElementNS(NS, 'polyline');
    pl.setAttribute('points', pts.map((p, i) => `${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(' '));
    pl.setAttribute('fill', 'none');
    pl.setAttribute('stroke', color);
    pl.setAttribute('stroke-width', '2.5');
    pl.setAttribute('stroke-linecap', 'round');
    svg.appendChild(pl);
  };
  line('nom', '#6b7280');
  line('adj', '#fbbf24');
  pts.forEach((p, i) => {
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('cx', x(i)); c.setAttribute('cy', y(p.adj));
    c.setAttribute('r', '3.5'); c.setAttribute('fill', '#fbbf24');
    svg.appendChild(c);
  });
  const leg = document.createElementNS(NS, 'text');
  leg.setAttribute('x', P + 4); leg.setAttribute('y', P + 8);
  leg.setAttribute('fill', '#9ca3af'); leg.setAttribute('font-size', '10');
  leg.textContent = 'gold = inflation-adjusted · grey = nominal';
  svg.appendChild(leg);
}

function renderCpi(cpi) {
  const box = $('cpiTable');
  box.innerHTML = '';
  const years = Object.keys(cpi).map(Number).sort((a, b) => b - a);
  for (const yr of years) {
    const lab = document.createElement('label');
    lab.innerHTML = `${yr}<input type="number" step="0.1" min="1" data-year="${yr}" value="${cpi[yr]}">`;
    box.appendChild(lab);
  }
}

/* ---------- actions ---------- */
async function addEntry() {
  const item = $('fItem').value.trim();
  const price = parseFloat($('fPrice').value);
  const dateStr = $('fDate').value;
  const msg = $('formMsg');
  if (!item || !(price > 0) || !dateStr) {
    msg.textContent = 'Please fill in item, price, and date.';
    msg.className = 'msg err';
    return;
  }
  const { [KEY_ENTRIES]: entries = [] } = await getStore();
  const year = Number(dateStr.slice(0, 4));
  entries.push({ id: 'e' + Date.now(), item, price, year, dateLabel: dateStr, created: Date.now() });
  await setStore({ [KEY_ENTRIES]: entries });
  $('fItem').value = ''; $('fPrice').value = ''; $('fDate').value = '';
  msg.textContent = 'Entry added.';
  msg.className = 'msg ok';
  await refresh();
}

async function deleteEntry(id) {
  const { [KEY_ENTRIES]: entries = [] } = await getStore();
  await setStore({ [KEY_ENTRIES]: entries.filter((e) => e.id !== id) });
  await refresh();
}

async function saveCpi() {
  const cpi = {};
  document.querySelectorAll('#cpiTable input').forEach((inp) => {
    const v = parseFloat(inp.value);
    if (v > 0) cpi[inp.dataset.year] = Math.round(v * 10) / 10;
  });
  await setStore({ [KEY_CPI]: cpi });
  await refresh();
}

async function resetCpi() {
  await setStore({ [KEY_CPI]: DEFAULT_CPI });
  await refresh();
}

async function clearEntries() {
  if (!confirm('Delete all logged entries?')) return;
  await setStore({ [KEY_ENTRIES]: [] });
  await refresh();
}

async function refresh() {
  const v = await getStore();
  const entries = v[KEY_ENTRIES] || [];
  const cpi = v[KEY_CPI] || DEFAULT_CPI;
  renderEntries(entries, cpi);
  renderCpi(cpi);
}

/* ---------- init ---------- */
// Guard DOM init so pure logic stays testable in Node.
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
  $('fDate').valueAsDate = new Date();
  $('btnAdd').addEventListener('click', addEntry);
  $('btnClear').addEventListener('click', clearEntries);
  $('btnCpiSave').addEventListener('click', saveCpi);
  $('btnCpiReset').addEventListener('click', resetCpi);
  refresh();
  });
}

// Exported for Node smoke tests (no DOM there).
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { adjustToCurrent, getCpiForYear, DEFAULT_CPI };
}
