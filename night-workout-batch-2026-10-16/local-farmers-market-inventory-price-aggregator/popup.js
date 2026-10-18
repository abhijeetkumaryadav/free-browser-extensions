/* Farmers Market Price Log — manual price logbook with local aggregation.
   100% local: all entries in chrome.storage.local. No network, no content script.
   Honest scope: aggregates ONLY user-typed prices. No live market data exists. */

'use strict';

const STORE_KEY = 'fmpl.entries.v1';
const DEL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>';

const $ = (id) => document.getElementById(id);

const todayISO = () => {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};

/* ---------- storage ---------- */
async function loadEntries() {
  const r = await chrome.storage.local.get(STORE_KEY);
  return Array.isArray(r[STORE_KEY]) ? r[STORE_KEY] : [];
}
async function saveEntries(list) {
  await chrome.storage.local.set({ [STORE_KEY]: list });
}

/* ---------- aggregation (pure, testable) ---------- */
function aggregate(items) {
  // items: entries for one produce item (same unit assumed within item+unit)
  // returns per-market stats: [{market, stall, count, avg, min, samples}]
  const byMarket = {};
  for (const e of items) {
    const key = e.market + ' \u00b7 ' + (e.stall || 'no stall');
    if (!byMarket[key]) byMarket[key] = { market: e.market, stall: e.stall, prices: [] };
    byMarket[key].prices.push(e.price);
  }
  const rows = Object.values(byMarket).map((g) => {
    const sum = g.prices.reduce((a, b) => a + b, 0);
    return { market: g.market, stall: g.stall, count: g.prices.length,
             avg: sum / g.prices.length, min: Math.min(...g.prices) };
  });
  rows.sort((a, b) => a.avg - b.avg);
  return rows;
}

function trendByDate(items) {
  // average price per date, chronological
  const byDate = {};
  for (const e of items) {
    if (!byDate[e.date]) byDate[e.date] = [];
    byDate[e.date].push(e.price);
  }
  return Object.keys(byDate).sort().map((d) => ({
    date: d.slice(5), // MM-DD
    avg: byDate[d].reduce((a, b) => a + b, 0) / byDate[d].length
  }));
}

const fmt$ = (n) => '$' + n.toFixed(2);

/* ---------- tabs ---------- */
document.querySelectorAll('.tab').forEach((t) => {
  t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'));
    document.querySelectorAll('.pane').forEach((x) => x.classList.remove('active'));
    t.classList.add('active');
    $('tab-' + t.dataset.tab).classList.add('active');
  });
});

/* ---------- log tab ---------- */
$('date').value = todayISO();

$('add-btn').addEventListener('click', async () => {
  const msg = $('log-msg');
  const item = $('item').value.trim();
  const price = parseFloat($('price').value);
  const unit = $('unit').value;
  const market = $('market').value.trim();
  const stall = $('stall').value.trim();
  const date = $('date').value || todayISO();

  if (!item) return flash(msg, 'Enter a produce item.', false);
  if (!(price > 0)) return flash(msg, 'Enter a valid price.', false);
  if (!market) return flash(msg, 'Enter the market name.', false);

  const list = await loadEntries();
  list.push({ id: Date.now() + '-' + Math.random().toString(36).slice(2, 7),
              item, price, unit, market, stall, date });
  await saveEntries(list);
  $('item').value = ''; $('price').value = ''; $('market').value = ''; $('stall').value = '';
  $('date').value = todayISO();
  flash(msg, 'Price logged.', true);
  await refreshAll();
});

function flash(el, text, ok) {
  el.textContent = text;
  el.className = 'msg ' + (ok ? 'ok' : 'err');
  setTimeout(() => { el.textContent = ''; el.className = 'msg'; }, 2500);
}

/* ---------- compare tab ---------- */
async function refreshCompare() {
  const list = await loadEntries();
  const items = [...new Set(list.map((e) => e.item))].sort();
  const sel = $('item-select');
  const prev = sel.value;
  sel.innerHTML = '<option value="">— select —</option>' +
    items.map((i) => `<option value="${esc(i)}">${esc(i)}</option>`).join('');
  if (items.includes(prev)) sel.value = prev;

  $('stat-items').textContent = items.length;
  $('stat-entries').textContent = list.length;
  $('stat-markets').textContent = new Set(list.map((e) => e.market)).size;
  renderCompare();
}

function renderCompare() {
  const selVal = $('item-select').value;
  const box = $('compare-results');
  const trendBox = $('trend-box');
  if (!selVal) {
    box.innerHTML = '<p class="empty">Pick an item to see market averages.</p>';
    trendBox.classList.add('hidden');
    return;
  }
  loadEntries().then((list) => {
    const items = list.filter((e) => e.item === selVal);
    if (!items.length) { box.innerHTML = '<p class="empty">No entries for this item.</p>'; return; }
    const unit = items[0].unit;
    const rows = aggregate(items);
    const best = rows[0];
    box.innerHTML = rows.map((r, i) => {
      const delta = best && r.avg > best.avg
        ? `<span class="delta-up">+${fmt$((r.avg - best.avg))} vs best</span>` : '';
      return `<div class="compare-card${i === 0 ? ' best' : ''}">
        <div><div class="c-market">${esc(r.market)}${i === 0 ? '<span class="best-tag">BEST</span>' : ''}</div>
        <div class="c-stall">${esc(r.stall || 'no stall')} · ${r.count} entr${r.count === 1 ? 'y' : 'ies'}</div>
        <div class="c-avg">avg ${fmt$(r.avg)} · low ${fmt$(r.min)} ${delta}</div></div>
        <div class="c-price">${fmt$(r.avg)}<span class="c-avg">/${unit}</span></div>
      </div>`;
    }).join('');

    const trend = trendByDate(items);
    if (trend.length >= 2) {
      const max = Math.max(...trend.map((t) => t.avg));
      $('trend-bars').innerHTML = trend.map((t) =>
        `<div class="trend-bar" style="height:${Math.max(6, (t.avg / max) * 100)}%" title="${fmt$(t.avg)}"></div>`).join('');
      trendBox.querySelector('.trend-x')?.remove();
      const x = document.createElement('div');
      x.className = 'trend-x';
      x.innerHTML = trend.map((t) => `<span>${esc(t.date)}</span>`).join('');
      $('trend-bars').after(x);
      trendBox.classList.remove('hidden');
    } else {
      trendBox.classList.add('hidden');
    }
  });
}

$('item-select').addEventListener('change', renderCompare);

/* ---------- entries tab ---------- */
async function refreshEntries() {
  const list = await loadEntries();
  const q = $('search').value.trim().toLowerCase();
  const filtered = list
    .filter((e) => !q || e.item.toLowerCase().includes(q) || e.market.toLowerCase().includes(q) ||
                   (e.stall || '').toLowerCase().includes(q))
    .sort((a, b) => b.date.localeCompare(a.date));
  const box = $('entry-list');
  if (!filtered.length) {
    box.innerHTML = '<p class="empty">No entries yet. Log your first price on the Log tab.</p>';
    return;
  }
  box.innerHTML = filtered.map((e) => `
    <div class="entry">
      <div><div class="e-item">${esc(e.item)}</div>
      <div class="e-meta">${esc(e.market)}${e.stall ? ' · ' + esc(e.stall) : ''} · ${esc(e.date)}</div></div>
      <div style="display:flex;align-items:center">
        <span class="e-price">${fmt$(e.price)}/${e.unit}</span>
        <button class="del" data-id="${e.id}" title="Delete">${DEL}</button>
      </div>
    </div>`).join('');
  box.querySelectorAll('.del').forEach((b) => b.addEventListener('click', async () => {
    const all = await loadEntries();
    await saveEntries(all.filter((e) => e.id !== b.dataset.id));
    await refreshAll();
  }));
}

$('search').addEventListener('input', refreshEntries);
$('clear-btn').addEventListener('click', async () => {
  if (!confirm('Delete ALL logged prices?')) return;
  await saveEntries([]);
  await refreshAll();
});

async function refreshAll() {
  await refreshCompare();
  await refreshEntries();
}

/* ---------- utils ---------- */
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Export pure logic for Node smoke tests (guarded so the popup is unaffected)
if (typeof module !== 'undefined') module.exports = { aggregate, trendByDate };

refreshAll();
