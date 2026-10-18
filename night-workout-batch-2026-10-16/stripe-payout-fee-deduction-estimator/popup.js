/* Stripe Payout Fee Estimator — 100% local fee math.
 * Estimate only: real Stripe fees depend on plan, country, currency, payment method.
 * Rates are user-editable; defaults = standard US card-not-present (2.9% + $0.30). */
'use strict';

const STORE_KEY = 'stripe_fee_estimates';
const $ = id => document.getElementById(id);

/* Parse pasted amounts: one per line or comma-separated; ignore junk. */
function parseAmounts(raw) {
  return raw
    .split(/[\n,;]+/)
    .map(s => s.trim().replace(/[$\s]/g, ''))
    .map(Number)
    .filter(n => isFinite(n) && n > 0);
}

/* Fee math: per-transaction fee = amt * rate + fixed. */
function estimate(amounts, ratePct, fixed) {
  const r = Math.max(0, ratePct) / 100;
  const f = Math.max(0, fixed);
  const gross = amounts.reduce((a, b) => a + b, 0);
  const fees = amounts.reduce((a, amt) => a + amt * r + f, 0);
  const net = Math.max(0, gross - fees);
  return {
    count: amounts.length,
    gross: round2(gross),
    fees: round2(fees),
    net: round2(net),
    effectivePct: gross > 0 ? (fees / gross) * 100 : 0,
  };
}
function round2(n) { return Math.round(n * 100) / 100; }

function money(n) {
  return '$' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

let lastResult = null;

$('calcBtn').addEventListener('click', () => {
  const amounts = parseAmounts($('amounts').value);
  if (!amounts.length) {
    $('resultsCard').style.display = 'none';
    alert('Enter at least one valid amount (e.g. 49.99).');
    return;
  }
  const res = estimate(amounts, parseFloat($('ratePct').value || '0'), parseFloat($('fixedFee').value || '0'));
  lastResult = { ...res, at: Date.now(), rate: $('ratePct').value, fixed: $('fixedFee').value };
  $('rNet').textContent = money(res.net);
  $('rGross').textContent = money(res.gross);
  $('rFees').textContent = money(res.fees);
  $('rCount').textContent = res.count;
  $('rEff').textContent = res.effectivePct.toFixed(2) + '%';
  $('resultsCard').style.display = 'block';
});

async function loadSaved() {
  const { [STORE_KEY]: arr } = await chrome.storage.local.get(STORE_KEY);
  return Array.isArray(arr) ? arr : [];
}

async function renderSaved() {
  const saved = await loadSaved();
  const ul = $('saved'); ul.innerHTML = '';
  $('emptyMsg').style.display = saved.length ? 'none' : 'block';
  [...saved].reverse().forEach((s, revIdx) => {
    const li = document.createElement('li');
    const d = new Date(s.at);
    li.innerHTML = `<div><span class="hist-net">${money(s.net)}</span> net of ${money(s.gross)}` +
      `<div class="hist-meta">${s.count} txns · ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ` +
      `${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} · ${s.rate}% + $${s.fixed}</div></div>`;
    const del = document.createElement('button');
    del.className = 'hist-del'; del.title = 'Delete';
    del.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/></svg>';
    del.addEventListener('click', async () => {
      const all = await loadSaved();
      all.splice(all.length - 1 - revIdx, 1);
      await chrome.storage.local.set({ [STORE_KEY]: all });
      renderSaved();
    });
    li.appendChild(del);
    ul.appendChild(li);
  });
}

$('saveBtn').addEventListener('click', async () => {
  if (!lastResult) return;
  const saved = await loadSaved();
  saved.push(lastResult);
  await chrome.storage.local.set({ [STORE_KEY]: saved.slice(-20) });
  renderSaved();
});

renderSaved();
