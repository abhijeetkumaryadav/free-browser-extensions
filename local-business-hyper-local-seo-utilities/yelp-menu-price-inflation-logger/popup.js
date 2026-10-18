/* Menu Price Log — popup logic
 * Manual menu-price tracker with per-item history and inflation %.
 * Every price is typed in by the user; nothing is scraped from Yelp
 * or any other site. All data lives in chrome.storage.local. */

'use strict';

/* ---------- tiny store ---------- */

const store = {
  state: { restaurants: [], items: [], prices: [] },

  async load() {
    const d = await chrome.storage.local.get(['mp_restaurants', 'mp_items', 'mp_prices']);
    this.state.restaurants = d.mp_restaurants || [];
    this.state.items = d.mp_items || [];
    this.state.prices = d.mp_prices || [];
  },

  async save() {
    await chrome.storage.local.set({
      mp_restaurants: this.state.restaurants,
      mp_items: this.state.items,
      mp_prices: this.state.prices
    });
  }
};

const uid = () => Math.random().toString(36).slice(2, 10);
const $ = (sel) => document.querySelector(sel);

function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function esc(s) {
  return (s || '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function fmtMoney(v) {
  return '$' + Number(v).toFixed(2);
}

function fmtDate(iso) {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function todayIso() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/* ---------- price math ---------- */

/** Sorted (oldest first) price entries for an item. */
function historyFor(itemId) {
  return store.state.prices
    .filter((p) => p.itemId === itemId)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Inflation % of last vs first logged price. Null when < 2 entries or first is 0. */
function inflationPct(hist) {
  if (hist.length < 2 || Number(hist[0].price) === 0) return null;
  const first = Number(hist[0].price), last = Number(hist[hist.length - 1].price);
  return ((last - first) / first) * 100;
}

function deltaBadge(pct) {
  if (pct === null) return '<span class="delta flat">—</span>';
  const cls = pct > 0.005 ? 'up' : pct < -0.005 ? 'down' : 'flat';
  const sign = pct > 0.005 ? '+' : '';
  return `<span class="delta ${cls}">${sign}${pct.toFixed(1)}%</span>`;
}

/* ---------- sparkline chart ---------- */

function drawChart(canvas, hist) {
  const W = 320, H = 64, pad = 6;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);
  if (hist.length < 2) return;

  const vals = hist.map((p) => Number(p.price));
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min || 1;
  const x = (i) => pad + (i * (W - 2 * pad)) / (hist.length - 1);
  const y = (v) => H - pad - ((v - min) / span) * (H - 2 * pad);

  // area fill
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, 'rgba(239,68,68,.35)');
  grad.addColorStop(1, 'rgba(239,68,68,0)');
  ctx.beginPath();
  ctx.moveTo(x(0), y(vals[0]));
  vals.forEach((v, i) => ctx.lineTo(x(i), y(v)));
  ctx.lineTo(x(vals.length - 1), H);
  ctx.lineTo(x(0), H);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // line
  ctx.beginPath();
  ctx.moveTo(x(0), y(vals[0]));
  vals.forEach((v, i) => ctx.lineTo(x(i), y(v)));
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 2;
  ctx.stroke();

  // last point dot
  ctx.beginPath();
  ctx.arc(x(vals.length - 1), y(vals[vals.length - 1]), 3.5, 0, Math.PI * 2);
  ctx.fillStyle = '#ef4444';
  ctx.fill();
}

/* ---------- tabs ---------- */

function initTabs() {
  document.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      $('#panel-' + btn.dataset.tab).classList.add('active');
    });
  });
}

/* ---------- restaurants & items ---------- */

function renderRests() {
  const box = $('#restList');
  box.innerHTML = '';
  if (!store.state.restaurants.length) {
    box.appendChild(el('<div class="empty">No restaurants yet.<br>Add one above to start logging prices.</div>'));
    return;
  }
  for (const r of store.state.restaurants) {
    const nItems = store.state.items.filter((i) => i.restId === r.id).length;
    const card = el(`
      <div class="card rest">
        <div class="top">
          <div>
            <div class="name">${esc(r.name)}</div>
            <div class="loc">${esc(r.location || '')}${r.location ? ' · ' : ''}${nItems} item${nItems === 1 ? '' : 's'}</div>
          </div>
          <button class="btn danger small" data-del="${r.id}">Delete</button>
        </div>
      </div>`);
    box.appendChild(card);
  }
  box.querySelectorAll('[data-del]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this restaurant and all its items and prices?')) return;
      const id = btn.dataset.del;
      const itemIds = new Set(store.state.items.filter((i) => i.restId === id).map((i) => i.id));
      store.state.restaurants = store.state.restaurants.filter((r) => r.id !== id);
      store.state.items = store.state.items.filter((i) => i.restId !== id);
      store.state.prices = store.state.prices.filter((p) => !itemIds.has(p.itemId));
      await store.save();
      refreshAll();
    }));
}

function initRestItemForms() {
  $('#restForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $('#restName').value.trim();
    if (!name) return;
    store.state.restaurants.push({ id: uid(), name, location: $('#restLoc').value.trim(), created: Date.now() });
    await store.save();
    e.target.reset();
    refreshAll();
  });

  $('#itemForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const restId = $('#itemRest').value;
    const name = $('#itemName').value.trim();
    if (!restId || !name) { alert('Add a restaurant first.'); return; }
    store.state.items.push({ id: uid(), restId, name, category: $('#itemCat').value.trim(), created: Date.now() });
    await store.save();
    e.target.reset();
    refreshAll();
  });
}

function restOptionsHTML(selected) {
  return store.state.restaurants
    .map((r) => `<option value="${r.id}"${r.id === selected ? ' selected' : ''}>${esc(r.name)}</option>`)
    .join('');
}

function refreshSelects() {
  $('#itemRest').innerHTML = restOptionsHTML($('#itemRest').value);
  $('#priceRest').innerHTML = restOptionsHTML($('#priceRest').value);
  $('#repRest').innerHTML = restOptionsHTML($('#repRest').value);
  refreshItemSelect();
}

/* ---------- log price ---------- */

function refreshItemSelect() {
  const restId = $('#priceRest').value;
  const items = store.state.items.filter((i) => i.restId === restId);
  $('#priceItem').innerHTML = items
    .map((i) => `<option value="${i.id}">${esc(i.name)}</option>`)
    .join('');
}

function initPriceForm() {
  $('#priceDate').value = todayIso();
  $('#priceRest').addEventListener('change', refreshItemSelect);
  $('#priceForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const itemId = $('#priceItem').value;
    const price = parseFloat($('#priceVal').value);
    const date = $('#priceDate').value || todayIso();
    if (!itemId || Number.isNaN(price) || price < 0) { alert('Pick an item and enter a valid price.'); return; }
    store.state.prices.push({ id: uid(), itemId, date, price: Math.round(price * 100) / 100 });
    await store.save();
    $('#priceVal').value = '';
    refreshAll();
    document.querySelector('[data-tab="report"]').click();
    renderReport();
  });
}

/* ---------- report ---------- */

function renderReport() {
  const restId = $('#repRest').value;
  const items = store.state.items.filter((i) => i.restId === restId);
  const moversBox = $('#movers');
  const itemsBox = $('#repItems');
  moversBox.innerHTML = '';
  itemsBox.innerHTML = '';

  if (!items.length) {
    itemsBox.appendChild(el('<div class="empty">No menu items for this restaurant yet.</div>'));
    return;
  }

  // biggest movers (needs >= 2 entries)
  const scored = items
    .map((i) => ({ item: i, hist: historyFor(i.id) }))
    .filter((x) => x.hist.length >= 2)
    .map((x) => ({ ...x, pct: inflationPct(x.hist) }))
    .filter((x) => x.pct !== null)
    .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))
    .slice(0, 3);

  if (scored.length) {
    moversBox.appendChild(el('<div class="form-title">Biggest movers</div>'));
    for (const s of scored) {
      moversBox.appendChild(el(`
        <div class="mover">
          <span>${esc(s.item.name)}</span>
          ${deltaBadge(s.pct)}
        </div>`));
    }
  }

  for (const item of items) {
    const hist = historyFor(item.id);
    const pct = inflationPct(hist);
    const last = hist.length ? fmtMoney(hist[hist.length - 1].price) : '—';
    const first = hist.length ? fmtMoney(hist[0].price) : '—';
    const card = el(`
      <div class="card itemcard">
        <div class="top">
          <div>
            <div class="name">${esc(item.name)}</div>
            <div class="cat">${esc(item.category || 'Uncategorized')}</div>
          </div>
          <button class="btn danger small" data-delitem="${item.id}">Delete</button>
        </div>
        <div class="meta">
          <span class="price">${last}</span>
          ${deltaBadge(pct)}
          <span class="from">first logged ${first} · ${hist.length} entr${hist.length === 1 ? 'y' : 'ies'}</span>
        </div>
        <canvas class="chart"></canvas>
        <div class="entries">
          ${hist.slice().reverse().map((p) => `
            <div class="entry">
              <span>${fmtDate(p.date)}</span>
              <span>${fmtMoney(p.price)} <button data-delprice="${p.id}" title="Delete">✕</button></span>
            </div>`).join('') || '<div class="empty">No prices logged yet.</div>'}
        </div>
      </div>`);
    itemsBox.appendChild(card);
    drawChart(card.querySelector('canvas'), hist);
  }

  itemsBox.querySelectorAll('[data-delitem]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this item and its price history?')) return;
      const id = btn.dataset.delitem;
      store.state.items = store.state.items.filter((i) => i.id !== id);
      store.state.prices = store.state.prices.filter((p) => p.itemId !== id);
      await store.save();
      refreshAll();
    }));

  itemsBox.querySelectorAll('[data-delprice]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      store.state.prices = store.state.prices.filter((p) => p.id !== btn.dataset.delprice);
      await store.save();
      refreshAll();
    }));
}

/* ---------- export ---------- */

function initExport() {
  $('#exportCsv').addEventListener('click', () => {
    const q = (v) => /[",\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v);
    const lines = [['Restaurant', 'Location', 'Item', 'Category', 'Date', 'Price']];
    for (const r of store.state.restaurants) {
      for (const i of store.state.items.filter((x) => x.restId === r.id)) {
        for (const p of historyFor(i.id)) {
          lines.push([r.name, r.location, i.name, i.category, p.date, p.price].map(q));
        }
      }
    }
    const blob = new Blob([lines.map((r) => r.join(',')).join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'menu-price-log.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  });
}

/* ---------- boot ---------- */

function refreshAll() {
  renderRests();
  refreshSelects();
  renderReport();
}

document.addEventListener('DOMContentLoaded', async () => {
  initTabs();
  initRestItemForms();
  initPriceForm();
  initExport();
  await store.load();
  refreshAll();
});
