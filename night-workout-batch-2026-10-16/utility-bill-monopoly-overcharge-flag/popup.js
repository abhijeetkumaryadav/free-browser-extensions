/* Bill Overcharge Flag — manual bill analyzer.
   Compares user-typed bills against a BUNDLED editable reference-rate table.
   Honest scope: educational flagger, approximate references — NOT proof of
   overcharging. 100% local (chrome.storage.local), no network, no content script. */

'use strict';

/* ---- bundled approximate reference rates (US national-ish averages, illustrative) ---- */
const DEFAULT_RATES = {
  electricity: { label: 'Electricity', unit: 'kWh',   refPerUnit: 0.17,  refMonthlyAvg: 140, note: '≈ $0.17/kWh; typical US home ≈ 140 $/mo' },
  water:       { label: 'Water',       unit: '1,000 gal', refPerUnit: 8.0, refMonthlyAvg: 72,  note: '≈ $8 per 1,000 gal; typical ≈ 72 $/mo' },
  gas:         { label: 'Natural gas', unit: 'therm',  refPerUnit: 1.35, refMonthlyAvg: 75,  note: '≈ $1.35/therm; typical ≈ 75 $/mo' },
  internet:    { label: 'Internet',    unit: 'flat',   refPerUnit: 0,    refMonthlyAvg: 75,  note: 'typical broadband ≈ 75 $/mo (flat rate)' },
  trash:       { label: 'Trash / sewer', unit: 'flat', refPerUnit: 0,    refMonthlyAvg: 55,  note: 'typical combined ≈ 55 $/mo (flat rate)' }
};

const BILLS_KEY = 'ubof.bills.v1';
const RATES_KEY = 'ubof.rates.v1';

const $ = (id) => document.getElementById(id);
const DEL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>';

/* ---------- pure analysis logic (testable) ---------- */
function analyzeBill(bill, rate) {
  // bill: {utility, usage, total, fixed}; rate: {refPerUnit, refMonthlyAvg}
  const flags = [];
  const variable = Math.max(0, bill.total - (bill.fixed || 0));

  if (rate.refPerUnit > 0 && bill.usage > 0) {
    const effRate = variable / bill.usage;
    const ratio = effRate / rate.refPerUnit;
    flags.push({ name: 'Effective per-unit rate: $' + effRate.toFixed(3) + '/' + rate.unit,
                 why: 'Reference is ≈ $' + rate.refPerUnit + '/' + rate.unit + '.',
                 ratio, kind: 'unit' });
  }
  const ratioTotal = bill.total / rate.refMonthlyAvg;
  flags.push({ name: 'Bill vs typical monthly: $' + bill.total.toFixed(2),
               why: 'Typical reference is ≈ $' + rate.refMonthlyAvg + '/mo.',
               ratio: ratioTotal, kind: 'total' });

  if (bill.fixed > 0 && bill.total > 0) {
    const share = bill.fixed / bill.total;
    if (share > 0.35) {
      flags.push({ name: 'Fixed fees are ' + Math.round(share * 100) + '% of the bill',
                   why: 'Fixed fees over ~35% of a bill are worth a closer look — ask what each fee covers.',
                   ratio: share / 0.35, kind: 'fees' });
    }
  }

  // verdict from worst ratio
  const worst = flags.reduce((m, f) => Math.max(m, f.ratio || 0), 0);
  let verdict, cls;
  if (worst >= 1.6)      { verdict = 'Looks high'; cls = 'high'; }
  else if (worst >= 1.25){ verdict = 'Elevated';   cls = 'elevated'; }
  else                   { verdict = 'Within typical range'; cls = 'normal'; }

  return { flags, verdict, cls, worst };
}

/* ---------- storage ---------- */
async function loadBills() {
  const r = await chrome.storage.local.get(BILLS_KEY);
  return Array.isArray(r[BILLS_KEY]) ? r[BILLS_KEY] : [];
}
async function saveBills(l) { await chrome.storage.local.set({ [BILLS_KEY]: l }); }
async function loadRates() {
  const r = await chrome.storage.local.get(RATES_KEY);
  return (r[RATES_KEY] && typeof r[RATES_KEY] === 'object') ? r[RATES_KEY] : JSON.parse(JSON.stringify(DEFAULT_RATES));
}
async function saveRates(t) { await chrome.storage.local.set({ [RATES_KEY]: t }); }

/* ---------- tabs ---------- */
document.querySelectorAll('.tab').forEach((t) => {
  t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'));
    document.querySelectorAll('.pane').forEach((x) => x.classList.remove('active'));
    t.classList.add('active');
    $('tab-' + t.dataset.tab).classList.add('active');
  });
});

/* ---------- analyze ---------- */
$('analyze-btn').addEventListener('click', async () => {
  const msg = $('bill-msg');
  const provider = $('provider').value.trim();
  const utility = $('utility').value;
  const month = $('month').value || new Date().toISOString().slice(0, 7);
  const usage = parseFloat($('usage').value) || 0;
  const total = parseFloat($('total').value);
  const fixed = parseFloat($('fixed').value) || 0;

  if (!provider) return flash(msg, 'Enter the provider name.', false);
  if (!(total > 0)) return flash(msg, 'Enter a valid bill total.', false);

  const rates = await loadRates();
  const bill = { id: Date.now() + '-' + Math.random().toString(36).slice(2, 7),
                 provider, utility, month, usage, total, fixed };
  const a = analyzeBill(bill, rates[utility]);
  bill.verdict = a.verdict; bill.cls = a.cls; bill.worst = a.worst; bill.flags = a.flags;

  const list = await loadBills();
  list.unshift(bill);
  await saveBills(list);

  $('provider').value = ''; $('usage').value = ''; $('total').value = ''; $('fixed').value = '';
  flash(msg, 'Bill analyzed — see Results.', true);
  await refreshResults();
  switchTab('results');
});

function switchTab(name) {
  document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x.dataset.tab === name));
  document.querySelectorAll('.pane').forEach((x) => x.classList.toggle('active', x.id === 'tab-' + name));
}

function flash(el, text, ok) {
  el.textContent = text; el.className = 'msg ' + (ok ? 'ok' : 'err');
  setTimeout(() => { el.textContent = ''; el.className = 'msg'; }, 2500);
}

/* ---------- results ---------- */
async function refreshResults() {
  const list = await loadBills();
  const latestBox = $('latest');
  if (list.length) {
    const b = list[0];
    const rate = (await loadRates())[b.utility];
    latestBox.innerHTML = `
      <div class="verdict ${b.cls}">
        <div class="v-title">${esc(b.verdict)} — ${esc(b.provider)}</div>
        <p>${esc(rate.label)} · ${esc(b.month)} · $${b.total.toFixed(2)}${b.usage ? ' · usage ' + esc(String(b.usage)) : ''}</p>
        <p>This compares your typed bill to approximate references — <strong>not proof of overcharging</strong>.</p>
      </div>` +
      (b.flags || []).map((f) => `
        <div class="flag-row"><div class="f-name">${esc(f.name)}</div>
        <div class="f-why">${esc(f.why)}</div></div>`).join('');
  } else {
    latestBox.innerHTML = '<p class="empty">No bills analyzed yet.</p>';
  }

  const box = $('bill-list');
  if (!list.length) { box.innerHTML = ''; return; }
  box.innerHTML = list.slice(1).map((b) => `
    <div class="bill">
      <div><div class="b-main">${esc(b.provider)}</div>
      <div class="b-meta">${esc(b.month)} · $${b.total.toFixed(2)}</div></div>
      <div style="display:flex;align-items:center;gap:8px">
        <span class="pill ${b.cls}">${esc(b.verdict)}</span>
        <button class="del" data-id="${b.id}" title="Delete">${DEL}</button>
      </div>
    </div>`).join('');
  box.querySelectorAll('.del').forEach((btn) => btn.addEventListener('click', async () => {
    const all = await loadBills();
    await saveBills(all.filter((b) => b.id !== btn.dataset.id));
    await refreshResults();
  }));
}

$('clear-btn').addEventListener('click', async () => {
  if (!confirm('Delete ALL analyzed bills?')) return;
  await saveBills([]);
  await refreshResults();
});

/* ---------- rates editor ---------- */
async function refreshRates() {
  const rates = await loadRates();
  $('rate-list').innerHTML = Object.entries(rates).map(([key, r]) => `
    <div class="rate-row" data-key="${key}">
      <div class="r-name">${esc(r.label)}</div>
      <div class="r-sub">approximate reference — edit to match your region</div>
      <div class="row">
        <div class="field"><label>Per ${esc(r.unit)} ($)</label>
          <input type="number" min="0" step="any" class="r-unit" value="${r.refPerUnit}"></div>
        <div class="field"><label>Typical $/mo</label>
          <input type="number" min="0" step="any" class="r-avg" value="${r.refMonthlyAvg}"></div>
      </div>
    </div>`).join('');
  $('rate-list').querySelectorAll('input').forEach((inp) => inp.addEventListener('change', async () => {
    const row = inp.closest('.rate-row');
    const key = row.dataset.key;
    const rates2 = await loadRates();
    rates2[key].refPerUnit = parseFloat(row.querySelector('.r-unit').value) || 0;
    rates2[key].refMonthlyAvg = parseFloat(row.querySelector('.r-avg').value) || 0;
    await saveRates(rates2);
  }));
}

$('reset-rates').addEventListener('click', async () => {
  await saveRates(JSON.parse(JSON.stringify(DEFAULT_RATES)));
  await refreshRates();
});

/* ---------- utils ---------- */
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

if (typeof module !== 'undefined') module.exports = { analyzeBill, DEFAULT_RATES };

(async function init() {
  await refreshRates();
  await refreshResults();
})();
