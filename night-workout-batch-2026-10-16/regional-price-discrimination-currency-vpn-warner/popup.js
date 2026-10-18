/* Regional Price Gap Watcher — user-logged price comparisons; no network.
   Educational awareness only: never advises evading geo-blocking or store terms. */
'use strict';

const $ = id => document.getElementById(id);

/* Seed FX rates are approximate and user-editable. Not live data. */
const DEFAULT_FX = { USD: 1, EUR: 1.09, GBP: 1.27, INR: 0.012, JPY: 0.0067, AUD: 0.66 };

const esc = s => String(s).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const toUSD = (amount, code, fx) => (fx[code] || 0) > 0 ? amount * fx[code] : null;

async function load() {
  const { pgEntries = [], pgFx = null } = await chrome.storage.local.get(['pgEntries', 'pgFx']);
  return { entries: pgEntries, fx: pgFx || { ...DEFAULT_FX } };
}
async function save(entries, fx) {
  await chrome.storage.local.set({ pgEntries: entries, pgFx: fx });
}

/* Render grouped comparisons: per product, convert all to USD and show gaps. */
function render(state) {
  const { entries, fx } = state;

  // currency dropdown
  $('currency').innerHTML = Object.keys(fx).map(c => `<option value="${c}">${c}</option>`).join('');

  // FX table
  $('fx').innerHTML = Object.entries(fx).map(([c, r]) =>
    `<div class="fxrow"><span><b>${esc(c)}</b> → $${r}</span>` +
    (c === 'USD' ? '<span></span>' : `<button data-fxdel="${esc(c)}" title="Remove">×</button>`) +
    `</div>`).join('');
  document.querySelectorAll('[data-fxdel]').forEach(b =>
    b.addEventListener('click', async () => {
      delete state.fx[b.dataset.fxdel];
      await save(state.entries, state.fx); render(state);
    }));

  // group entries by product (case-insensitive)
  const groups = {};
  entries.forEach((e, i) => {
    const k = e.product.trim().toLowerCase();
    (groups[k] = groups[k] || { name: e.product, rows: [] }).rows.push({ ...e, i });
  });
  const box = $('list');
  const names = Object.keys(groups);
  if (!names.length) {
    box.innerHTML = '<p class="empty">No entries yet. Log two prices for the same product to compare.</p>';
    return;
  }
  box.innerHTML = names.map(k => {
    const g = groups[k];
    const conv = g.rows.map(r => ({ ...r, usd: toUSD(r.price, r.currency, fx) }));
    const priced = conv.filter(r => r.usd != null).sort((a, b) => a.usd - b.usd);
    let gap = '';
    if (priced.length >= 2) {
      const lo = priced[0], hi = priced[priced.length - 1];
      const diff = hi.usd - lo.usd, pct = lo.usd > 0 ? (diff / lo.usd * 100) : 0;
      gap = `<div class="gap">Gap: $${diff.toFixed(2)} (${pct.toFixed(1)}%) between ` +
        `${esc(lo.region)} and ${esc(hi.region)}. Observed by you — taxes, licensing ` +
        `and local economics explain most gaps.</div>`;
    }
    const rows = g.rows.map(r =>
      `<div class="entry"><span>${esc(r.region)} — ${esc(r.currency)} ${r.price.toFixed(2)}` +
      (r.usd != null ? ` <i>≈ $${r.usd.toFixed(2)}</i>` : '') +
      `</span><button class="del" data-del="${r.i}" title="Delete">×</button></div>`).join('');
    return `<div class="group"><h3>${esc(g.name)}</h3>${rows}${gap}</div>`;
  }).join('');
  document.querySelectorAll('[data-del]').forEach(b =>
    b.addEventListener('click', async () => {
      state.entries.splice(Number(b.dataset.del), 1);
      await save(state.entries, state.fx); render(state);
    }));
}

document.addEventListener('DOMContentLoaded', async () => {
  const state = await load();
  render(state);

  $('add').addEventListener('click', async () => {
    const product = $('product').value.trim();
    const region = $('region').value.trim();
    const price = parseFloat($('price').value);
    if (!product || !region || !(price >= 0)) return;
    state.entries.push({ product, region, currency: $('currency').value, price, at: Date.now() });
    $('product').value = ''; $('region').value = ''; $('price').value = '';
    await save(state.entries, state.fx); render(state);
  });

  $('fxAdd').addEventListener('click', async () => {
    const code = $('fxCode').value.trim().toUpperCase();
    const rate = parseFloat($('fxRate').value);
    if (!/^[A-Z]{3}$/.test(code) || !(rate > 0)) return;
    state.fx[code] = rate;
    $('fxCode').value = ''; $('fxRate').value = '';
    await save(state.entries, state.fx); render(state);
  });

  $('clearAll').addEventListener('click', async () => {
    if (!confirm('Delete all logged price entries?')) return;
    state.entries = [];
    await save(state.entries, state.fx); render(state);
  });
});
